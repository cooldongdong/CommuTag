import Vue from "vue";
import "./setup.js";
import datasetStatistic from "../vue/dataset-statistic.vue";

new Vue({
  el: "#statisticApp",
  render: (h) => h(datasetStatistic),
});
