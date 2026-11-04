import Vue from "vue";
import "./setup.js";
import login from "../vue/login.vue";

new Vue({
  el: "#loginApp",
  render: (h) => h(login),
});
