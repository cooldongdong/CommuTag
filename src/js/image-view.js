import Vue from "vue";
import "./setup.js";
import imageView from "../vue/image-view.vue";

new Vue({
  el: "#imageViewApp",
  render: (h) => h(imageView),
});
