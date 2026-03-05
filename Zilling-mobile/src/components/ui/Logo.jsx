import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const Logo = ({ width = 250, height = 250, style }) => {
    return (
        <Svg
            width={width}
            height={height}
            viewBox="0 0 250 250"
            fill="none"
            style={style}
        >
            <Path
                d="m241.8 187.5h-32.03v-67.44l15.12-92.1-92.8 16.82 23.85 22.21-72.12 84.55c-10.2 12.1-16.03 24.38-16.03 37.06 0 15.67 10.33 31.92 27.63 31.92h115.5c16.15 0 30.86-14.34 30.86-33.02zm-29.43-146.8-9.75 59.49-15.75-15.15-88.05 90.7c-9.63 10.33-14.42 18.52-14.76 27.97-3.59-3.92-5.93-9.55-5.93-15.14 0-9.86 5.13-19.7 14.12-30.4l76.68-91.16-16.75-16.75 60.19-9.56zm-12.85 71.79v74.78h-87.5c-0.05 1.19-0.05 2.4-0.19 3.59-1.1 8.93-9.61 18.77-16.41 18.77-1.33 0-1.69-2.66-1.69-4.01 0-8.33 5.19-15.98 12.69-24.08l26.53-28.93c1.08 12.79 13.1 23.56 26.75 23.56 6.37 0 10.83-1.21 15.2-4.58l4.43 4.85h13.04l-9.24-10.08c4.29-5.6 5.25-10.55 5.25-18.12 0-12.1-9.88-25.38-17.72-26.55l-6.47 7.98c8.94 2.12 14.44 9.25 14.44 18.02 0 5.1-0.81 8.05-3.18 11.38-3.37-2.93-4.79-5.05-8.72-5.05-3.1 0-4.51 1.42-6.31 4.05l7.7 7.3c-2.19 1.08-4.49 1.42-7.86 1.42-10.13 0-17.34-8.4-17.34-17.85 0-2.78 0.47-5.85 1.9-7.8l42.05-42.33 12.65 13.68zm11.42 98.11h-97.5c4.18-5.45 5.74-8.24 6.58-13.39h109.9c-2.89 8.08-10.74 13.39-18.97 13.39z"
                fill="url(#paint0_linear_1_108)"
            />
            <Path d="m125.4 86.07h-77.83v9.84h69.79l8.04-9.84z" fill="url(#paint1_linear_1_108)" />
            <Path d="m107 108.1h-81.1v9.7h72.94l8.16-9.7z" fill="url(#paint2_linear_1_108)" />
            <Path d="m7.5 129.4v10.05h72.38l8.44-10.05h-80.82z" fill="url(#paint3_linear_1_108)" />
            <Defs>
                <LinearGradient
                    id="paint0_linear_1_108"
                    x1="67.78"
                    y1="124.3"
                    x2="241.8"
                    y2="124.3"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop stopColor="#297BAF" />
                    <Stop offset="1" stopColor="#196BA7" />
                </LinearGradient>
                <LinearGradient
                    id="paint1_linear_1_108"
                    x1="47.59"
                    y1="90.99"
                    x2="125.4"
                    y2="90.99"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop stopColor="#297BAF" />
                    <Stop offset="1" stopColor="#196BA7" />
                </LinearGradient>
                <LinearGradient
                    id="paint2_linear_1_108"
                    x1="25.87"
                    y1="112.9"
                    x2="107"
                    y2="112.9"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop stopColor="#297BAF" />
                    <Stop offset="1" stopColor="#196BA7" />
                </LinearGradient>
                <LinearGradient
                    id="paint3_linear_1_108"
                    x1="7.5"
                    y1="134.4"
                    x2="88.32"
                    y2="134.4"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop stopColor="#297BAF" />
                    <Stop offset="1" stopColor="#196BA7" />
                </LinearGradient>
            </Defs>
        </Svg>
    );
};

export default Logo;
