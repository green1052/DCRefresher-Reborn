<template>
  <transition name="refresher-opacity">
    <div class="refresher-loader spinner">
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
      <div class="spinner-blade"/>
    </div>
  </transition>
</template>

<style lang="scss">
.spinner {
  height: 40px;
  position: relative;
  width: 40px;
}

.spinner .spinner-blade {
  animation: spinnerBlade 1s linear infinite;
  background-color: #8e8e93;
  border-radius: 50%/20%;
  height: 25%;
  left: 44.5%;
  position: absolute;
  top: 37%;
  width: 10%;
  will-change: opacity;
}

.spinner .spinner-blade:nth-child(1) {
  animation-delay: -1.6666666667s;
  transform: rotate(30deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(2) {
  animation-delay: -1.5833333333s;
  transform: rotate(60deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(3) {
  animation-delay: -1.5s;
  transform: rotate(90deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(4) {
  animation-delay: -1.4166666667s;
  transform: rotate(120deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(5) {
  animation-delay: -1.3333333333s;
  transform: rotate(150deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(6) {
  animation-delay: -1.25s;
  transform: rotate(180deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(7) {
  animation-delay: -1.1666666667s;
  transform: rotate(210deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(8) {
  animation-delay: -1.0833333333s;
  transform: rotate(240deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(9) {
  animation-delay: -1s;
  transform: rotate(270deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(10) {
  animation-delay: -0.9166666667s;
  transform: rotate(300deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(11) {
  animation-delay: -0.8333333333s;
  transform: rotate(330deg) translate(0, -150%);
}

.spinner .spinner-blade:nth-child(12) {
  animation-delay: -0.75s;
  transform: rotate(360deg) translate(0, -150%);
}

.spinner.spinner-large {
  height: 35px;
  width: 35px;
}

.spinner.spinner-large .spinner-blade {
  border-radius: 50%/16.67%;
  height: 51.428571429%;
  width: 17.142857143%;
}

@keyframes spinnerBlade {
  0% {
    opacity: 0.85;
  }
  50% {
    opacity: 0.25;
  }
  100% {
    opacity: 0.25;
  }
}
</style>