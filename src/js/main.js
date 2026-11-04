import Vue from "vue";
import "./setup.js";
import mainApp from "../vue/main-app.vue";

new Vue({
  el: "#mainApp",
  render: (h) => h(mainApp),
});
