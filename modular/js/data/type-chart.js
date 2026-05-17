(() => {
  const TYPE_ORDER = [
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy"
  ];

  const TYPE_DATA = {
    normal: { name: "Normal", emoji: "⚪", color: "#A8A77A" },
    fire: { name: "Fire", emoji: "🔥", color: "#EE8130" },
    water: { name: "Water", emoji: "💧", color: "#6390F0" },
    electric: { name: "Electric", emoji: "⚡", color: "#F7D02C" },
    grass: { name: "Grass", emoji: "🍃", color: "#7AC74C" },
    ice: { name: "Ice", emoji: "❄️", color: "#96D9D6" },
    fighting: { name: "Fighting", emoji: "👊", color: "#C22E28" },
    poison: { name: "Poison", emoji: "☠️", color: "#A33EA1" },
    ground: { name: "Ground", emoji: "🌍", color: "#E2BF65" },
    flying: { name: "Flying", emoji: "🕊️", color: "#A98FF3" },
    psychic: { name: "Psychic", emoji: "🔮", color: "#F95587" },
    bug: { name: "Bug", emoji: "🐛", color: "#A6B91A" },
    rock: { name: "Rock", emoji: "🪨", color: "#B6A136" },
    ghost: { name: "Ghost", emoji: "👻", color: "#735797" },
    dragon: { name: "Dragon", emoji: "🐉", color: "#6F35FC" },
    dark: { name: "Dark", emoji: "🌑", color: "#705746" },
    steel: { name: "Steel", emoji: "⚙️", color: "#B7B7CE" },
    fairy: { name: "Fairy", emoji: "🧚", color: "#D685AD" }
  };

  const TYPE_RELATIONS = {
    normal: { super: [], resist: ["rock", "steel"], immune: ["ghost"] },
    fire: { super: ["grass", "ice", "bug", "steel"], resist: ["fire", "water", "rock", "dragon"], immune: [] },
    water: { super: ["fire", "ground", "rock"], resist: ["water", "grass", "dragon"], immune: [] },
    electric: { super: ["water", "flying"], resist: ["electric", "grass", "dragon"], immune: ["ground"] },
    grass: { super: ["water", "ground", "rock"], resist: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], immune: [] },
    ice: { super: ["grass", "ground", "flying", "dragon"], resist: ["fire", "water", "ice", "steel"], immune: [] },
    fighting: { super: ["normal", "ice", "rock", "dark", "steel"], resist: ["poison", "flying", "psychic", "bug", "fairy"], immune: ["ghost"] },
    poison: { super: ["grass", "fairy"], resist: ["poison", "ground", "rock", "ghost"], immune: ["steel"] },
    ground: { super: ["fire", "electric", "poison", "rock", "steel"], resist: ["grass", "bug"], immune: ["flying"] },
    flying: { super: ["grass", "fighting", "bug"], resist: ["electric", "rock", "steel"], immune: [] },
    psychic: { super: ["fighting", "poison"], resist: ["psychic", "steel"], immune: ["dark"] },
    bug: { super: ["grass", "psychic", "dark"], resist: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"], immune: [] },
    rock: { super: ["fire", "ice", "flying", "bug"], resist: ["fighting", "ground", "steel"], immune: [] },
    ghost: { super: ["psychic", "ghost"], resist: ["dark"], immune: ["normal"] },
    dragon: { super: ["dragon"], resist: ["steel"], immune: ["fairy"] },
    dark: { super: ["psychic", "ghost"], resist: ["fighting", "dark", "fairy"], immune: [] },
    steel: { super: ["ice", "rock", "fairy"], resist: ["fire", "water", "electric", "steel"], immune: [] },
    fairy: { super: ["fighting", "dragon", "dark"], resist: ["fire", "poison", "steel"], immune: [] }
  };

  const PULSE_STYLES = {
    2.56: { label: "Double Weakness", endColor: "#ff3d6c", speed: 9.6, width: 3.6, glow: 28, alpha: 0.92, mode: "flash" },
    1.6: { label: "Super Effective", endColor: "#ff6c73", speed: 5.4, width: 2.8, glow: 20, alpha: 0.86, mode: "flash" },
    0.625: { label: "Resistance", endColor: "#63c8ff", speed: 1.9, width: 2.3, glow: 16, alpha: 0.78, mode: "breathe" },
    0.39: { label: "Double Resistance / Immune", endColor: "#f3f7ff", speed: 0.95, width: 2, glow: 14, alpha: 0.72, mode: "fade" },
    0.24: { label: "Triple Resistance", endColor: "#beeaff", speed: 0.55, width: 1.9, glow: 12, alpha: 0.68, mode: "fade" }
  };

  const TYPE_NETWORK_DATA = {
    TYPE_ORDER,
    TYPE_DATA,
    TYPE_RELATIONS,
    PULSE_STYLES,
    COMBINED_VALUES: [2.56, 1.6, 1, 0.625, 0.39, 0.24],
    MAX_IDLE_LINE_ALPHA: 0.2,
    STAR_DENSITY: 120
  };

  window.TypeNetworkData = Object.freeze(TYPE_NETWORK_DATA);
})();