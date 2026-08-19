<template>
    <transition name="refresher-opacity">
        <div class="refresher-loader spinner">
            <div
                v-for="i in 12"
                :key="i"
                class="spinner-blade"
            />
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

@for $i from 1 through 12 {
    .spinner .spinner-blade:nth-child(#{$i}) {
        animation-delay: #{($i - 21) * 0.0833333333}s;
        transform: rotate(#{$i * 30}deg) translate(0, -150%);
    }
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

.refresher-loader {
    margin: auto;
    position: relative;
}
</style>