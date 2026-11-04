import Vue from "vue";
import "./setup.js";
import account from "../vue/account.vue";

new Vue({
  el: "#accountApp",
  render: (h) => h(account),
});
