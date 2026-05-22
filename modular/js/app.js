(() => {
  const canvas = document.getElementById("network");
  const ctx = canvas.getContext("2d");
  const statusElement = document.getElementById("status");
  const resetButton = document.getElementById("resetButton");
  const modeTabs = document.querySelectorAll(".mode-tab");
  const typeDataService = window.createTypeDataService();
  const {
    typeOrder: TYPE_ORDER,
    typeData: TYPE_DATA,
    pulseStyles: PULSE_STYLES,
    combinedValues: COMBINED_VALUES,
    maxIdleLineAlpha: MAX_IDLE_LINE_ALPHA,
    starDensity: STAR_DENSITY
  } = typeDataService.getConfig();

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    center: { x: 0, y: 0 },
    ringRadius: 0,
    nodeRadius: 35,
    centerRadius: 72,
    nodes: [],
    selectedTypes: [],
    hoverType: null,
    lastPointerType: "mouse",
    stars: [],
    lastStatus: "",
    viewMode: "defender"
  };

  const typeChart = typeDataService.getTypeChart();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function normalize(vector) {
    const length = Math.hypot(vector.x, vector.y) || 1;
    return { x: vector.x / length, y: vector.y / length };
  }

  function perpendicular(vector) {
    return { x: -vector.y, y: vector.x };
  }

  function rgba(hex, alpha) {
    const normalized = hex.replace("#", "");
    const full = normalized.length === 3
      ? normalized.split("").map((value) => value + value).join("")
      : normalized;
    const red = Number.parseInt(full.slice(0, 2), 16);
    const green = Number.parseInt(full.slice(2, 4), 16);
    const blue = Number.parseInt(full.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function normalizeCombinedMultiplier(value) {
    return COMBINED_VALUES.reduce((closest, candidate) => {
      return Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest;
    }, COMBINED_VALUES[0]);
  }

  function getPulse(multiplier, time) {
    const style = PULSE_STYLES[multiplier];
    if (!style) {
      return { intensity: 0, alpha: 0.24, width: 1.2, glow: 0, endColor: "rgba(255,255,255,0.18)" };
    }

    const wave = (Math.sin(time * style.speed) + 1) / 2;
    let intensity;

    if (style.mode === "flash") {
      intensity = Math.pow(wave, multiplier === 2.56 ? 6 : 4);
    } else if (style.mode === "breathe") {
      intensity = 0.35 + wave * 0.65;
    } else {
      intensity = 0.18 + wave * 0.52;
    }

    return {
      intensity,
      alpha: clamp(style.alpha * (0.72 + intensity * 0.4), 0, 1),
      width: style.width + intensity * 1.2,
      glow: style.glow + intensity * 18,
      endColor: style.endColor,
      label: style.label
    };
  }

  function getMode() {
    if (state.viewMode === "attacker") {
      if (state.selectedTypes.length === 2) {
        return { kind: "attacker-dual", attackers: [...state.selectedTypes] };
      }
      if (state.selectedTypes.length === 1) {
        return { kind: "attacker-single", attacker: state.selectedTypes[0], locked: true };
      }
      if (state.hoverType) {
        return { kind: "attacker-single", attacker: state.hoverType, locked: false };
      }
      return { kind: "idle" };
    }

    if (state.selectedTypes.length === 2) {
      return { kind: "dual", defenders: [...state.selectedTypes] };
    }

    if (state.selectedTypes.length === 1) {
      return { kind: "single", defender: state.selectedTypes[0], locked: true };
    }

    if (state.hoverType) {
      return { kind: "single", defender: state.hoverType, locked: false };
    }

    return { kind: "idle" };
  }

  function buildLayout() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;

    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    state.center = {
      x: state.width / 2,
      y: state.height / 2
    };

    const compact = state.width < 720 || state.height < 720;
    state.nodeRadius = compact ? 26 : 35;
    state.centerRadius = compact ? 58 : 76;

    const minDimension = Math.min(state.width, state.height);
    const padding = compact ? 56 : 92;
    const preferredRadius = minDimension * (compact ? 0.34 : 0.38);
    const maxRadius = Math.max(108, minDimension / 2 - padding);
    const minRadius = compact ? Math.min(124, maxRadius) : Math.min(150, maxRadius);
    state.ringRadius = clamp(preferredRadius, minRadius, maxRadius);

    state.nodes = TYPE_ORDER.map((type, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / TYPE_ORDER.length;
      return {
        type,
        angle,
        radius: state.nodeRadius,
        x: state.center.x + Math.cos(angle) * state.ringRadius,
        y: state.center.y + Math.sin(angle) * state.ringRadius
      };
    });

    rebuildStars();
  }

  function rebuildStars() {
    state.stars = Array.from({ length: STAR_DENSITY }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: randomBetween(0.35, 1.9),
      alpha: randomBetween(0.06, 0.42),
      twinkle: randomBetween(0.35, 1.65),
      phase: randomBetween(0, Math.PI * 2),
      drift: randomBetween(8, 28)
    }));
  }

  function getNode(type) {
    return state.nodes.find((node) => node.type === type);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function getHitTarget(point, padding = 0) {
    const mode = getMode();

    if ((mode.kind === "dual" || mode.kind === "attacker-dual") && distance(point, state.center) <= state.centerRadius + padding) {
      return { kind: "center" };
    }

    for (let index = state.nodes.length - 1; index >= 0; index -= 1) {
      const node = state.nodes[index];
      if (mode.kind === "dual" && mode.defenders.includes(node.type)) {
        continue;
      }
      if (mode.kind === "attacker-dual" && mode.attackers.includes(node.type)) {
        continue;
      }

      if (distance(point, node) <= node.radius + padding) {
        return { kind: "node", node };
      }
    }

    return null;
  }

  function clearSelections() {
    state.selectedTypes = [];
    state.hoverType = null;
    updateStatus();
  }

  function handlePointerMove(event) {
    state.lastPointerType = event.pointerType || "mouse";
    const point = pointFromEvent(event);
    const target = getHitTarget(point, event.pointerType === "touch" ? 12 : 0);
    canvas.style.cursor = target ? "pointer" : "default";

    if (state.selectedTypes.length === 0 && event.pointerType !== "touch") {
      state.hoverType = target && target.kind === "node" ? target.node.type : null;
      updateStatus();
    }
  }

  function handlePointerLeave() {
    canvas.style.cursor = "default";
    if (state.selectedTypes.length === 0) {
      state.hoverType = null;
      updateStatus();
    }
  }

  function handlePointerDown(event) {
    state.lastPointerType = event.pointerType || "mouse";
    const point = pointFromEvent(event);
    const target = getHitTarget(point, event.pointerType === "touch" ? 14 : 4);
    const mode = getMode();

    if (!target) {
      if (state.selectedTypes.length === 0) {
        state.hoverType = null;
      }
      updateStatus();
      return;
    }

    if (target.kind === "center") {
      clearSelections();
      return;
    }

    const { type } = target.node;

    if (mode.kind === "dual") {
      state.selectedTypes = [type];
      state.hoverType = null;
      updateStatus();
      return;
    }

    if (state.selectedTypes.length === 0) {
      state.selectedTypes = [type];
      state.hoverType = type;
      updateStatus();
      return;
    }

    if (state.selectedTypes.length === 1 && state.selectedTypes[0] === type) {
      clearSelections();
      return;
    }

    if (state.selectedTypes.length === 1 && state.selectedTypes[0] !== type) {
      state.selectedTypes = [state.selectedTypes[0], type];
      state.hoverType = null;
      updateStatus();
    }
  }

  function updateStatus() {
    const mode = getMode();
    let text;

    if (mode.kind === "idle") {
      text = state.viewMode === "attacker"
        ? "Attacker mode: hover or click a type to see which types it can hit super-effectively (\xd71.6 or \xd72.56). Click a second type for dual-type coverage."
        : "Idle web: every type stays fully bright while the full attack lattice glows in the background.";
    } else if (mode.kind === "single") {
      const label = TYPE_DATA[mode.defender].name;
      text = mode.locked
        ? `${label} is locked as the defender. Nodes with no incoming interaction dim to 25%. Click one more type to build a dual defender.`
        : `${label} is the live hover defender. Attackers with non-neutral incoming damage stay bright and pulse at speed based on multiplier.`;
    } else if (mode.kind === "dual") {
      const [first, second] = mode.defenders;
      text = `${TYPE_DATA[first].name} + ${TYPE_DATA[second].name} now form the center defender. Straight shots use combined Pokemon GO multipliers and neutral attackers dim away.`;
    } else if (mode.kind === "attacker-single") {
      const label = TYPE_DATA[mode.attacker].name;
      text = mode.locked
        ? `${label} is your attacker \u2014 bright nodes are types it hits super-effectively. Click a second type to combine attack coverage.`
        : `${label} attack preview \u2014 only super-effective targets stay bright.`;
    } else if (mode.kind === "attacker-dual") {
      const [first, second] = mode.attackers;
      text = `${TYPE_DATA[first].name} + ${TYPE_DATA[second].name} dual attacker \u2014 spiral lines show coverage from both types. Only effective hits are shown.`;
    }

    if (text !== state.lastStatus) {
      statusElement.textContent = text;
      state.lastStatus = text;
    }

    resetButton.disabled = state.selectedTypes.length === 0;
  }

  function drawBackground(time) {
    ctx.clearRect(0, 0, state.width, state.height);

    const vignette = ctx.createRadialGradient(
      state.center.x,
      state.center.y,
      state.ringRadius * 0.15,
      state.center.x,
      state.center.y,
      Math.max(state.width, state.height) * 0.7
    );
    vignette.addColorStop(0, "rgba(16, 20, 30, 0.95)");
    vignette.addColorStop(0.5, "rgba(10, 10, 15, 0.98)");
    vignette.addColorStop(1, "rgba(3, 3, 5, 1)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, state.width, state.height);

    drawNebula(state.center.x - state.ringRadius * 0.6, state.center.y - state.ringRadius * 0.45, state.ringRadius * 0.55, "rgba(74, 122, 255, 0.12)");
    drawNebula(state.center.x + state.ringRadius * 0.72, state.center.y - state.ringRadius * 0.3, state.ringRadius * 0.42, "rgba(255, 80, 140, 0.08)");
    drawNebula(state.center.x + state.ringRadius * 0.1, state.center.y + state.ringRadius * 0.74, state.ringRadius * 0.35, "rgba(116, 255, 231, 0.06)");

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;

    for (let ring = 1; ring <= 3; ring += 1) {
      ctx.beginPath();
      ctx.arc(state.center.x, state.center.y, state.ringRadius * (0.36 + ring * 0.18), 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let index = 0; index < TYPE_ORDER.length; index += 1) {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / TYPE_ORDER.length;
      ctx.beginPath();
      ctx.moveTo(state.center.x + Math.cos(angle) * 54, state.center.y + Math.sin(angle) * 54);
      ctx.lineTo(state.center.x + Math.cos(angle) * (state.ringRadius + 20), state.center.y + Math.sin(angle) * (state.ringRadius + 20));
      ctx.stroke();
    }

    ctx.restore();

    drawStars(time);
  }

  function drawNebula(x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStars(time) {
    ctx.save();
    ctx.fillStyle = "#ffffff";

    state.stars.forEach((star) => {
      const x = star.x * state.width + Math.sin(time * 0.08 + star.phase) * star.drift;
      const y = star.y * state.height + Math.cos(time * 0.06 + star.phase) * star.drift * 0.35;
      const alpha = clamp(star.alpha + Math.sin(time * star.twinkle + star.phase) * 0.18, 0.03, 0.6);

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawArrowHead(tip, direction, color, alpha, size) {
    const normalized = normalize(direction);
    const orthogonal = perpendicular(normalized);
    const base = {
      x: tip.x - normalized.x * size,
      y: tip.y - normalized.y * size
    };

    ctx.save();
    ctx.fillStyle = rgba(color, alpha);
    ctx.shadowColor = rgba(color, alpha);
    ctx.shadowBlur = size * 1.25;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(base.x + orthogonal.x * size * 0.56, base.y + orthogonal.y * size * 0.56);
    ctx.lineTo(base.x - orthogonal.x * size * 0.56, base.y - orthogonal.y * size * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCurvedLink(attackerNode, defenderNode, multiplier, options = {}) {
    const baseline = Boolean(options.baseline);
    const pulse = baseline ? null : getPulse(multiplier, options.time);
    const attackerColor = TYPE_DATA[attackerNode.type].color;
    const effectColor = pulse ? pulse.endColor : multiplier > 1 ? "#ff6c73" : multiplier < 0.39 ? "#f3f7ff" : "#63c8ff";
    const startDirection = normalize({ x: state.center.x - attackerNode.x, y: state.center.y - attackerNode.y });
    const endDirection = normalize({ x: defenderNode.x - state.center.x, y: defenderNode.y - state.center.y });
    const start = {
      x: attackerNode.x + startDirection.x * attackerNode.radius,
      y: attackerNode.y + startDirection.y * attackerNode.radius
    };
    const end = {
      x: defenderNode.x - endDirection.x * defenderNode.radius,
      y: defenderNode.y - endDirection.y * defenderNode.radius
    };

    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const alpha = baseline ? MAX_IDLE_LINE_ALPHA : pulse.alpha;
    gradient.addColorStop(0, rgba(attackerColor, baseline ? alpha * 0.76 : alpha));
    gradient.addColorStop(1, rgba(effectColor, alpha));

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = baseline ? 1.3 : pulse.width;
    ctx.shadowColor = rgba(effectColor, baseline ? 0.18 : 0.5 + pulse.intensity * 0.25);
    ctx.shadowBlur = baseline ? 6 : pulse.glow;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(state.center.x, state.center.y, end.x, end.y);
    ctx.stroke();
    ctx.restore();

    drawArrowHead(end, endDirection, effectColor, baseline ? 0.5 : 0.9, baseline ? 6 : 8 + pulse.intensity * 2.4);
  }

  function drawLoopLink(node, multiplier, time, baseline = false) {
    const pulse = baseline ? null : getPulse(multiplier, time);
    const attackerColor = TYPE_DATA[node.type].color;
    const effectColor = pulse ? pulse.endColor : multiplier > 1 ? "#ff6c73" : multiplier < 0.39 ? "#f3f7ff" : "#63c8ff";
    const outward = normalize({ x: node.x - state.center.x, y: node.y - state.center.y });
    const tangent = perpendicular(outward);
    const lift = node.radius * 2.15;
    const start = {
      x: node.x + tangent.x * node.radius * 0.62 - outward.x * node.radius * 0.18,
      y: node.y + tangent.y * node.radius * 0.62 - outward.y * node.radius * 0.18
    };
    const end = {
      x: node.x - tangent.x * node.radius * 0.56 - outward.x * node.radius * 0.1,
      y: node.y - tangent.y * node.radius * 0.56 - outward.y * node.radius * 0.1
    };
    const controlA = {
      x: node.x + tangent.x * node.radius * 1.7 + outward.x * lift,
      y: node.y + tangent.y * node.radius * 1.7 + outward.y * lift
    };
    const controlB = {
      x: node.x - tangent.x * node.radius * 1.9 + outward.x * lift,
      y: node.y - tangent.y * node.radius * 1.9 + outward.y * lift
    };

    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    const alpha = baseline ? MAX_IDLE_LINE_ALPHA : pulse.alpha;
    gradient.addColorStop(0, rgba(attackerColor, baseline ? alpha * 0.76 : alpha));
    gradient.addColorStop(1, rgba(effectColor, alpha));

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = baseline ? 1.3 : pulse.width;
    ctx.shadowColor = rgba(effectColor, baseline ? 0.18 : 0.56);
    ctx.shadowBlur = baseline ? 5 : pulse.glow;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(controlA.x, controlA.y, controlB.x, controlB.y, end.x, end.y);
    ctx.stroke();
    ctx.restore();

    const derivative = normalize({
      x: end.x - controlB.x,
      y: end.y - controlB.y
    });
    drawArrowHead(end, derivative, effectColor, baseline ? 0.5 : 0.9, baseline ? 6 : 8 + (pulse ? pulse.intensity * 2 : 0));
  }

  function drawStraightLink(attackerNode, multiplier, time) {
    const direction = normalize({ x: state.center.x - attackerNode.x, y: state.center.y - attackerNode.y });
    const start = {
      x: attackerNode.x + direction.x * attackerNode.radius,
      y: attackerNode.y + direction.y * attackerNode.radius
    };
    const end = {
      x: state.center.x - direction.x * state.centerRadius,
      y: state.center.y - direction.y * state.centerRadius
    };

    const pulse = multiplier === 1 ? null : getPulse(multiplier, time);
    const attackerColor = TYPE_DATA[attackerNode.type].color;
    const effectColor = multiplier === 1 ? "rgba(255,255,255,0.12)" : pulse.endColor;
    const alpha = multiplier === 1 ? 0.09 : pulse.alpha;
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);

    gradient.addColorStop(0, rgba(attackerColor, multiplier === 1 ? 0.14 : alpha));
    gradient.addColorStop(1, multiplier === 1 ? "rgba(255,255,255,0.08)" : rgba(effectColor, alpha));

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = multiplier === 1 ? 1.2 : pulse.width;
    ctx.shadowColor = multiplier === 1 ? "rgba(255,255,255,0.06)" : rgba(effectColor, 0.55);
    ctx.shadowBlur = multiplier === 1 ? 3 : pulse.glow;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();

    drawArrowHead(end, direction, multiplier === 1 ? "#a9b0bc" : effectColor, multiplier === 1 ? 0.22 : 0.92, multiplier === 1 ? 5.5 : 8 + pulse.intensity * 2.2);
  }

  function drawIdleLinks() {
    TYPE_ORDER.forEach((attacker) => {
      TYPE_ORDER.forEach((defender) => {
        const multiplier = typeChart[attacker][defender];
        if (multiplier === 1) {
          return;
        }

        const attackerNode = getNode(attacker);
        const defenderNode = getNode(defender);

        if (attacker === defender) {
          drawLoopLink(attackerNode, multiplier, 0, true);
        } else {
          drawCurvedLink(attackerNode, defenderNode, multiplier, { baseline: true, time: 0 });
        }
      });
    });
  }

  function drawSingleFocus(mode, time) {
    TYPE_ORDER.forEach((attacker) => {
      const multiplier = typeChart[attacker][mode.defender];
      if (multiplier === 1) {
        return;
      }

      const attackerNode = getNode(attacker);
      const defenderNode = getNode(mode.defender);

      if (attacker === mode.defender) {
        drawLoopLink(attackerNode, multiplier, time, false);
      } else {
        drawCurvedLink(attackerNode, defenderNode, multiplier, { time });
      }
    });
  }

  function drawDualFocus(mode, time) {
    TYPE_ORDER.forEach((type) => {
      const attackerNode = getNode(type);
      if (mode.defenders.includes(type)) {
        // Still draw if this defender type attacks the combined center non-neutrally
        const combined = normalizeCombinedMultiplier(typeChart[type][mode.defenders[0]] * typeChart[type][mode.defenders[1]]);
        if (combined !== 1) {
          drawStraightLink(attackerNode, combined, time);
        }
        return;
      }

      const combined = normalizeCombinedMultiplier(typeChart[type][mode.defenders[0]] * typeChart[type][mode.defenders[1]]);
      drawStraightLink(attackerNode, combined, time);
    });
  }

  function drawStraightLinkToTarget(targetNode, multiplier, attackerType, time) {
    const direction = normalize({ x: targetNode.x - state.center.x, y: targetNode.y - state.center.y });
    const start = {
      x: state.center.x + direction.x * state.centerRadius,
      y: state.center.y + direction.y * state.centerRadius
    };
    const end = {
      x: targetNode.x - direction.x * targetNode.radius,
      y: targetNode.y - direction.y * targetNode.radius
    };

    const pulse = getPulse(multiplier, time);
    const attackerColor = TYPE_DATA[attackerType].color;
    const effectColor = pulse.endColor;
    const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, rgba(attackerColor, pulse.alpha));
    gradient.addColorStop(1, rgba(effectColor, pulse.alpha));

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = pulse.width;
    ctx.shadowColor = rgba(effectColor, 0.55);
    ctx.shadowBlur = pulse.glow;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();

    drawArrowHead(end, direction, effectColor, 0.92, 8 + pulse.intensity * 2.2);
  }

  function drawSpiralLinksToTarget(targetNode, mult1, mult2, attacker1, attacker2, time) {
    const direction = normalize({ x: targetNode.x - state.center.x, y: targetNode.y - state.center.y });
    const perp = perpendicular(direction);
    const dist = distance(state.center, targetNode);
    const offset = Math.min(dist * 0.26, 55);

    const start = {
      x: state.center.x + direction.x * state.centerRadius,
      y: state.center.y + direction.y * state.centerRadius
    };
    const end = {
      x: targetNode.x - direction.x * targetNode.radius,
      y: targetNode.y - direction.y * targetNode.radius
    };

    const oneThird = {
      x: start.x + (end.x - start.x) / 3,
      y: start.y + (end.y - start.y) / 3
    };
    const twoThirds = {
      x: start.x + (end.x - start.x) * 2 / 3,
      y: start.y + (end.y - start.y) * 2 / 3
    };

    const pulse1 = getPulse(normalizeCombinedMultiplier(mult1), time);
    const color1 = TYPE_DATA[attacker1].color;
    const ctrl1a = { x: oneThird.x + perp.x * offset, y: oneThird.y + perp.y * offset };
    const ctrl1b = { x: twoThirds.x - perp.x * offset, y: twoThirds.y - perp.y * offset };
    const gradient1 = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient1.addColorStop(0, rgba(color1, pulse1.alpha));
    gradient1.addColorStop(1, rgba(pulse1.endColor, pulse1.alpha));

    ctx.save();
    ctx.strokeStyle = gradient1;
    ctx.lineWidth = pulse1.width * 0.8;
    ctx.shadowColor = rgba(pulse1.endColor, 0.45);
    ctx.shadowBlur = pulse1.glow * 0.75;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(ctrl1a.x, ctrl1a.y, ctrl1b.x, ctrl1b.y, end.x, end.y);
    ctx.stroke();
    ctx.restore();

    const pulse2 = getPulse(normalizeCombinedMultiplier(mult2), time);
    const color2 = TYPE_DATA[attacker2].color;
    const ctrl2a = { x: oneThird.x - perp.x * offset, y: oneThird.y - perp.y * offset };
    const ctrl2b = { x: twoThirds.x + perp.x * offset, y: twoThirds.y + perp.y * offset };
    const gradient2 = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient2.addColorStop(0, rgba(color2, pulse2.alpha));
    gradient2.addColorStop(1, rgba(pulse2.endColor, pulse2.alpha));

    ctx.save();
    ctx.strokeStyle = gradient2;
    ctx.lineWidth = pulse2.width * 0.8;
    ctx.shadowColor = rgba(pulse2.endColor, 0.45);
    ctx.shadowBlur = pulse2.glow * 0.75;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(ctrl2a.x, ctrl2a.y, ctrl2b.x, ctrl2b.y, end.x, end.y);
    ctx.stroke();
    ctx.restore();

    const bestPulse = mult1 >= mult2 ? pulse1 : pulse2;
    drawArrowHead(end, direction, bestPulse.endColor, 0.92, 8 + bestPulse.intensity * 2.2);
  }

  function drawAttackerSingleFocus(mode, time) {
    const attackerNode = getNode(mode.attacker);
    TYPE_ORDER.forEach((defender) => {
      const multiplier = typeChart[mode.attacker][defender];
      if (multiplier <= 1) {
        return;
      }
      const defenderNode = getNode(defender);
      if (mode.attacker === defender) {
        drawLoopLink(attackerNode, multiplier, time, false);
      } else {
        drawCurvedLink(attackerNode, defenderNode, multiplier, { time });
      }
    });
  }

  function drawAttackerDualFocus(mode, time) {
    TYPE_ORDER.forEach((type) => {
      const mult1 = typeChart[mode.attackers[0]][type];
      const mult2 = typeChart[mode.attackers[1]][type];
      const eff1 = mult1 > 1;
      const eff2 = mult2 > 1;
      if (!eff1 && !eff2) {
        return;
      }
      const targetNode = getNode(type);
      if (mode.attackers.includes(type)) {
        // Self-target: one or both attackers hit their own type — draw straight link from center out to ring node
        const attacker = eff1 ? mode.attackers[0] : mode.attackers[1];
        const mult = normalizeCombinedMultiplier(eff1 ? mult1 : mult2);
        drawStraightLinkToTarget(targetNode, mult, attacker, time);
        return;
      }
      if (eff1 && eff2) {
        drawSpiralLinksToTarget(targetNode, mult1, mult2, mode.attackers[0], mode.attackers[1], time);
      } else {
        const attacker = eff1 ? mode.attackers[0] : mode.attackers[1];
        const mult = normalizeCombinedMultiplier(eff1 ? mult1 : mult2);
        drawStraightLinkToTarget(targetNode, mult, attacker, time);
      }
    });
  }

  function getNodeVisual(type, mode, time) {
    const baseVisual = {
      opacity: 1,
      glow: 0.16,
      halo: 0.14,
      scale: 1,
      pulse: null,
      focused: false
    };

    if (mode.kind === "idle") {
      return baseVisual;
    }

    if (mode.kind === "single") {
      if (type === mode.defender) {
        return {
          opacity: 1,
          glow: 0.95,
          halo: 0.65,
          scale: 1.04,
          pulse: getPulse(typeChart[type][type] === 1 ? 1.6 : typeChart[type][type], time),
          focused: true
        };
      }

      const multiplier = typeChart[type][mode.defender];
      if (multiplier !== 1) {
        return {
          opacity: 1,
          glow: 0.42,
          halo: 0.28,
          scale: 1,
          pulse: getPulse(multiplier, time),
          focused: false
        };
      }

      return {
        opacity: 0.25,
        glow: 0.04,
        halo: 0,
        scale: 1,
        pulse: null,
        focused: false
      };
    }

    if (mode.defenders.includes(type)) {
      // Keep defenders visible in ring with a "selected defender" style
      return {
        opacity: 0.82,
        glow: 0.72,
        halo: 0.45,
        scale: 1.04,
        pulse: getPulse(1.6, time),
        focused: true
      };
    }

    const combined = normalizeCombinedMultiplier(typeChart[type][mode.defenders[0]] * typeChart[type][mode.defenders[1]]);
    if (combined !== 1) {
      return {
        opacity: 1,
        glow: 0.4,
        halo: 0.28,
        scale: 1,
        pulse: getPulse(combined, time),
        focused: false
      };
    }

    return {
      opacity: 0.25,
      glow: 0.04,
      halo: 0,
      scale: 1,
      pulse: null,
      focused: false
    };
  }

  function getNodeVisualAttacker(type, mode, time) {
    if (mode.kind === "attacker-single") {
      if (type === mode.attacker) {
        return {
          opacity: 1,
          glow: 0.95,
          halo: 0.65,
          scale: 1.04,
          pulse: getPulse(1.6, time),
          focused: true
        };
      }
      const multiplier = typeChart[mode.attacker][type];
      if (multiplier > 1) {
        return {
          opacity: 1,
          glow: 0.42,
          halo: 0.28,
          scale: 1,
          pulse: getPulse(multiplier, time),
          focused: false
        };
      }
      return { opacity: 0.25, glow: 0.04, halo: 0, scale: 1, pulse: null, focused: false };
    }

    if (mode.kind === "attacker-dual") {
      if (mode.attackers.includes(type)) {
        // Keep attacker nodes visible in ring with a "selected attacker" style
        return {
          opacity: 0.82,
          glow: 0.72,
          halo: 0.45,
          scale: 1.04,
          pulse: getPulse(1.6, time),
          focused: true
        };
      }
      const mult1 = typeChart[mode.attackers[0]][type];
      const mult2 = typeChart[mode.attackers[1]][type];
      const best = Math.max(mult1, mult2);
      if (best > 1) {
        return {
          opacity: 1,
          glow: 0.4,
          halo: 0.28,
          scale: 1,
          pulse: getPulse(normalizeCombinedMultiplier(best), time),
          focused: false
        };
      }
      return { opacity: 0.25, glow: 0.04, halo: 0, scale: 1, pulse: null, focused: false };
    }

    return { opacity: 1, glow: 0.16, halo: 0.14, scale: 1, pulse: null, focused: false };
  }

  function drawNode(node, visual) {
    if (visual.hidden) {
      return;
    }

    const { color, emoji, name } = TYPE_DATA[node.type];
    const pulseBoost = visual.pulse ? visual.pulse.intensity : 0;
    const haloRadius = node.radius * (1.55 + visual.halo * 0.35 + pulseBoost * 0.08);
    const ringWidth = 2.2 + visual.glow * 1.6 + pulseBoost * 0.4;
    const scaledRadius = node.radius * visual.scale;

    ctx.save();
    ctx.globalAlpha = visual.opacity;

    if (visual.halo > 0) {
      const halo = ctx.createRadialGradient(node.x, node.y, scaledRadius * 0.6, node.x, node.y, haloRadius);
      halo.addColorStop(0, rgba(color, 0.08 + visual.halo * 0.08 + pulseBoost * 0.08));
      halo.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = rgba(color, 0.35 + visual.glow * 0.22 + pulseBoost * 0.12);
    ctx.shadowBlur = 10 + visual.glow * 18 + pulseBoost * 12;
    ctx.fillStyle = "rgba(3, 3, 5, 0.96)";
    ctx.beginPath();
    ctx.arc(node.x, node.y, scaledRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = rgba(color, 0.95);
    ctx.beginPath();
    ctx.arc(node.x, node.y, scaledRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(node.x, node.y, scaledRadius - 3.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = rgba("#ffffff", 0.95);
    ctx.font = `700 ${Math.round(scaledRadius * 0.82)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, node.x, node.y - scaledRadius * 0.23);

    ctx.fillStyle = rgba("#ffffff", 0.93);
    ctx.font = `700 ${Math.max(10, Math.round(scaledRadius * 0.33))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillText(name.toUpperCase(), node.x, node.y + scaledRadius * 0.43);

    ctx.restore();
  }

  function drawCenterNode(types, time) {
    const [leftType, rightType] = types;
    const left = TYPE_DATA[leftType];
    const right = TYPE_DATA[rightType];
    const glowMix = 0.65 + Math.sin(time * 1.6) * 0.08;

    ctx.save();

    const aura = ctx.createRadialGradient(
      state.center.x,
      state.center.y,
      state.centerRadius * 0.5,
      state.center.x,
      state.center.y,
      state.centerRadius * 2.2
    );
    aura.addColorStop(0, rgba(left.color, 0.18));
    aura.addColorStop(0.45, rgba(right.color, 0.12));
    aura.addColorStop(1, rgba("#000000", 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = rgba(left.color, 0.28);
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(3, 3, 5, 0.97)";
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(left.color, glowMix);
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 2.5, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.stroke();

    ctx.strokeStyle = rgba(right.color, glowMix);
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(state.centerRadius * 0.52)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(`${left.emoji} ${right.emoji}`, state.center.x, state.center.y - state.centerRadius * 0.16);

    ctx.font = `800 ${Math.max(12, Math.round(state.centerRadius * 0.22))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillText(`${left.name.toUpperCase()} / ${right.name.toUpperCase()}`, state.center.x, state.center.y + state.centerRadius * 0.2);

    ctx.font = `600 ${Math.max(10, Math.round(state.centerRadius * 0.15))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    ctx.fillText("COMBINED DEFENDER", state.center.x, state.center.y + state.centerRadius * 0.44);

    ctx.restore();
  }

  function drawCenterNodeAttacker(types, time) {
    const [leftType, rightType] = types;
    const left = TYPE_DATA[leftType];
    const right = TYPE_DATA[rightType];
    const glowMix = 0.65 + Math.sin(time * 1.6) * 0.08;

    ctx.save();

    const aura = ctx.createRadialGradient(
      state.center.x,
      state.center.y,
      state.centerRadius * 0.5,
      state.center.x,
      state.center.y,
      state.centerRadius * 2.2
    );
    aura.addColorStop(0, rgba(left.color, 0.18));
    aura.addColorStop(0.45, rgba(right.color, 0.12));
    aura.addColorStop(1, rgba("#000000", 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = rgba(left.color, 0.28);
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(3, 3, 5, 0.97)";
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(left.color, glowMix);
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 2.5, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.stroke();

    ctx.strokeStyle = rgba(right.color, glowMix);
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 2.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 80, 100, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, state.centerRadius - 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(state.centerRadius * 0.52)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(`${left.emoji} ${right.emoji}`, state.center.x, state.center.y - state.centerRadius * 0.16);

    ctx.font = `800 ${Math.max(12, Math.round(state.centerRadius * 0.22))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillText(`${left.name.toUpperCase()} / ${right.name.toUpperCase()}`, state.center.x, state.center.y + state.centerRadius * 0.2);

    ctx.font = `600 ${Math.max(10, Math.round(state.centerRadius * 0.15))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillStyle = "rgba(255, 140, 150, 0.85)";
    ctx.fillText("COMBINED ATTACKER", state.center.x, state.center.y + state.centerRadius * 0.44);

    ctx.restore();
  }

  function drawSingleCenterIndicator(type, role, time) {
    const { color, emoji, name } = TYPE_DATA[type];
    const r = state.centerRadius * 0.72;
    const glowPulse = 0.5 + Math.sin(time * 2.0) * 0.15;
    const accentColor = role === "attacker" ? "#ff8a90" : "#8ee7ff";

    ctx.save();

    const aura = ctx.createRadialGradient(state.center.x, state.center.y, r * 0.3, state.center.x, state.center.y, r * 1.85);
    aura.addColorStop(0, rgba(color, 0.1));
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, r * 1.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = rgba(color, 0.28);
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(3, 3, 5, 0.93)";
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 3.2;
    ctx.strokeStyle = rgba(color, 0.75 + glowPulse * 0.18);
    ctx.shadowColor = rgba(color, 0.45);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(state.center.x, state.center.y, r - 1.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.font = `700 ${Math.round(r * 0.72)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, state.center.x, state.center.y - r * 0.14);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = `800 ${Math.max(10, Math.round(r * 0.3))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillText(name.toUpperCase(), state.center.x, state.center.y + r * 0.34);

    ctx.font = `600 ${Math.max(9, Math.round(r * 0.2))}px "Segoe UI Variable Display", "Aptos", sans-serif`;
    ctx.fillStyle = accentColor;
    ctx.fillText(role === "attacker" ? "ATTACKING" : "DEFENDING", state.center.x, state.center.y + r * 0.58);

    ctx.restore();
  }

  function render(timestamp) {
    const time = timestamp * 0.001;
    const mode = getMode();

    drawBackground(time);

    if (mode.kind === "idle") {
      drawIdleLinks();
    } else if (mode.kind === "single") {
      drawSingleFocus(mode, time);
    } else if (mode.kind === "dual") {
      drawDualFocus(mode, time);
    } else if (mode.kind === "attacker-single") {
      drawAttackerSingleFocus(mode, time);
    } else if (mode.kind === "attacker-dual") {
      drawAttackerDualFocus(mode, time);
    }

    state.nodes.forEach((node) => {
      const isAttackerMode = mode.kind === "attacker-single" || mode.kind === "attacker-dual";
      const visual = isAttackerMode
        ? getNodeVisualAttacker(node.type, mode, time)
        : getNodeVisual(node.type, mode, time);
      drawNode(node, visual);
    });

    if (mode.kind === "dual") {
      drawCenterNode(mode.defenders, time);
    } else if (mode.kind === "attacker-dual") {
      drawCenterNodeAttacker(mode.attackers, time);
    } else if (mode.kind === "single") {
      drawSingleCenterIndicator(mode.defender, "defender", time);
    } else if (mode.kind === "attacker-single") {
      drawSingleCenterIndicator(mode.attacker, "attacker", time);
    }

    requestAnimationFrame(render);
  }

  resetButton.addEventListener("click", clearSelections);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerleave", handlePointerLeave);
  canvas.addEventListener("pointerdown", handlePointerDown);
  window.addEventListener("resize", buildLayout);

  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const newMode = tab.dataset.mode;
      if (state.viewMode === newMode) {
        return;
      }
      state.viewMode = newMode;
      state.selectedTypes = [];
      state.hoverType = null;
      modeTabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === newMode));
      state.lastStatus = "";
      updateStatus();
    });
  });

  buildLayout();
  updateStatus();
  requestAnimationFrame(render);
})();