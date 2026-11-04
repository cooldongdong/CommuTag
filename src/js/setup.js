// Shared bootstrap for every page entry: Vue, Quasar (UMD build installs itself
// on the Vue it requires), and jQuery as a global because components call $.get/$.post.
import Vue from "vue";
import $ from "jquery";
import "quasar/dist/quasar.umd.js";
import "quasar/dist/quasar.min.css";

window.Vue = Vue;
window.$ = window.jQuery = $;
