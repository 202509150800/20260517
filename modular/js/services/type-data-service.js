(() => {
  function buildTypeChart(typeOrder, typeRelations) {
    const chart = {};

    typeOrder.forEach((attacker) => {
      chart[attacker] = {};

      typeOrder.forEach((defender) => {
        chart[attacker][defender] = 1;
      });

      typeRelations[attacker].super.forEach((defender) => {
        chart[attacker][defender] = 1.6;
      });

      typeRelations[attacker].resist.forEach((defender) => {
        chart[attacker][defender] = 0.625;
      });

      typeRelations[attacker].immune.forEach((defender) => {
        chart[attacker][defender] = 0.39;
      });
    });

    return chart;
  }

  function createTypeDataService(dataSource = window.TypeNetworkData) {
    if (!dataSource) {
      throw new Error("TypeNetworkData is not loaded.");
    }

    const typeChart = buildTypeChart(dataSource.TYPE_ORDER, dataSource.TYPE_RELATIONS);

    return {
      getConfig() {
        return {
          typeOrder: dataSource.TYPE_ORDER,
          typeData: dataSource.TYPE_DATA,
          pulseStyles: dataSource.PULSE_STYLES,
          combinedValues: dataSource.COMBINED_VALUES,
          maxIdleLineAlpha: dataSource.MAX_IDLE_LINE_ALPHA,
          starDensity: dataSource.STAR_DENSITY
        };
      },

      getTypeChart() {
        return typeChart;
      },

      getDefenderMultiplier(attacker, defender) {
        return typeChart[attacker][defender];
      },

      normalizeCombinedMultiplier(value) {
        return dataSource.COMBINED_VALUES.reduce((closest, candidate) => {
          return Math.abs(candidate - value) < Math.abs(closest - value) ? candidate : closest;
        }, dataSource.COMBINED_VALUES[0]);
      },

      async load() {
        return {
          config: this.getConfig(),
          typeChart
        };
      }
    };
  }

  window.createTypeDataService = createTypeDataService;
})();