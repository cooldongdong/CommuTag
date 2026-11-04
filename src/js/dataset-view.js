import Vue from "vue";
import "./setup.js";
import datasetView from "../vue/dataset-view.vue";

new Vue({
  el: "#datasetViewApp",
  render: (h) => h(datasetView),
});
