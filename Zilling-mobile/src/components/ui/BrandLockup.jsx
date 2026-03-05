import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const BrandLockup = ({ width = 250, height = 70, style, variant = 'dark' }) => {
    const isLight = variant === 'light';
    const kwiqColor = isLight ? '#FFFFFF' : '#0E3A5D';
    const billColor = isLight ? '#F0F9FF' : '#2B87BC';
    const subtitleColor = isLight ? 'rgba(255,255,255,0.7)' : '#94A3B8';
    const logoGradientColor = isLight ? '#FFFFFF' : '#00568E';

    return (
        <Svg
            width={width}
            height={height}
            viewBox="0 0 250 170"
            fill="none"
            style={style}
        >
            {/* ── Logo Icon ── */}
            <Path
                d="m72.19 123.2 4.74-29.51-30.11 4.92 8.4 7.79-24.43 26.32c-8.86 9.62-6.64 22.82 3.05 22.82h39.92c7.41 0 9.06-10.05 9.06-10.45h-10.63v-21.89zm-13.25-17.32-6.06-6.16 20.45-2.42-3.12 21.27-5.38-5.98-31.22 32.83c-3.44 3.64-3.6 6.14-3.95 5.28-1.98-4.66 0.35-10.61 3.95-14.21l25.33-30.61zm12 39.21h-30.27c-2.58 2.05-3.54 6.5-3.54 7.46h-2.98c-0.38-4.73 3.56-8.81 5.28-10.54l9.18-10.22c0 5.38 3.52 9.28 8.83 9.28 1.8 0 3.19-0.58 4.35-1.47l1.63 2.29h3.54l-3.13-4c1.4-1.87 1.98-3.6 1.98-6.18 0-3.95-2.08-6.53-5.28-7.9l-2.15 2.33c2.82 0.95 4.55 2.68 4.55 5.88 0 1.72-0.43 3.12-1.32 4.37l-1.98-2.7h-3.89l3.13 4c-0.65 0.35-1.51 0.51-2.54 0.51-3.84 0-6.52-2.58-6.52-7.21l15.37-14.81 5.76 5.82v23.09zm3.17 7.01h-34.37c0.96-1.16 1.92-3.04 2.27-4.51h37.69c-0.96 2.33-2.59 4.51-5.59 4.51z"
                fill="url(#bl_paint0)"
            />
            <Path d="m18.33 112.9h26.38l-1.98 3.05h-24.4v-3.05z" fill="url(#bl_paint1)" />
            <Path d="m12.08 119.5h26.38l-1.98 3.05h-24.4v-3.05z" fill="url(#bl_paint2)" />
            <Path d="m6.25 126.4h26.38l-1.98 3.05h-24.4v-3.05z" fill="url(#bl_paint3)" />

            {/* ── "kwiq" text ── */}
            <Path d="m106.1 114.8h5.85l-8.14 9.15 8.69 11.22h-6.24l-8.65-10.71v10.71h-5.38v-31.56h5.11v19.01l7.93-7.82h0.83z" fill={kwiqColor} />
            <Path d="m139.5 114.8h6.01l-7.04 20.37h-5.27l-4.22-13.89-4.46 13.89h-5.38l-6.96-20.37h5.57l4.5 13.52 4.62-13.52h4.6l4.66 13.52 3.37-13.52z" fill={kwiqColor} />
            <Path d="m147.8 108.2c0-2.74 1.67-3.09 3.14-3.09 2.15 0 3.21 1.25 3.21 3.09 0 1.72-1.21 2.97-3.21 2.97-1.89 0-3.14-1.05-3.14-2.97zm0.16 6.57h5.38v20.37h-5.38v-20.37z" fill={kwiqColor} />
            <Path d="m186.9 108c-5.21 3.44-12.48 13.22-16.87 19.72-0.78 1.17-1.9 1.04-2.6 0l-2.82-4.08c-0.68-1 0.37-2.55 2.17-1.9l1.62 1.08c1.42-2.05 4.43-5.76 5.04-6.5-1.72-1.3-3.61-2.06-6.35-2.06-6.76 0-9.74 5.78-9.74 10.52 0 5.38 3.63 10.76 9.78 10.76 2.95 0 5.15-1.22 7.3-3.2v12.03h4.79v-24.28l-1.13 0.7c-1.96 3.17-3.91 6.4-5.27 8.28-1.99 2.92-5.74 3.32-7.7 0.97-1.5-1.87-2.99-3.98-2.99-5.63 0-3.19 2.66-6.02 5.53-6.02 1.6 0 2.7 0.4 3.66 1.2 4.65-5.32 9.7-9.7 15.58-12v0.41z" fill={kwiqColor} />

            {/* ── "bill" text ── */}
            <Path d="m213.7 118.7c2.07 3.96 1.63 9.46-1.1 12.9-2.25 2.99-4.86 3.93-8.35 3.93-2.98 0-5.35-1.3-6.98-3.55v3.13h-4.09v-31.56h4.5v14.2c1.62-2.15 3.8-3.17 6.93-3.17 4.31 0 7.22 1.3 9.09 4.12zm-4.5 10.56c2.11-3.05 1.93-7.96-0.49-10.46-1.25-1.25-2.55-1.66-4.49-1.66-4.08 0-6.67 3.05-6.67 7.44 0 4.4 2.79 7.6 6.88 7.6 2.15 0 3.62-1 4.77-2.92z" fill={billColor} />
            <Path d="m218.6 107.9c0-2.22 1.26-2.87 2.73-2.87 1.87 0 2.93 1.15 2.93 2.87 0 1.65-1.13 2.78-2.93 2.78-1.62 0-2.73-1.05-2.73-2.78zm0.73 7.04h4.32v20.22h-4.32v-20.22z" fill={billColor} />
            <Path d="m229.2 103.6h4.56v31.56h-4.56v-31.56z" fill={billColor} />
            <Path d="m239.2 103.6h4.56v31.56h-4.56v-31.56z" fill={billColor} />

            {/* ── "MINIMALISTIC INVOICING" subtitle ── */}
            <Path d="m100 148.6v6.71h-0.96v-4.97l-2.83 4.97h-0.61l-2.79-4.93v4.93h-0.96v-6.71h0.83l3.25 5.81 3.24-5.81h0.83z" fill={subtitleColor} />
            <Path d="m103 148.6h1v6.71h-1v-6.71z" fill={subtitleColor} />
            <Path d="m112.8 148.6v6.71h-0.81l-4.15-5.4v5.4h-0.97v-6.71h0.8l4.16 5.4v-5.4h0.97z" fill={subtitleColor} />
            <Path d="m116.1 148.6h0.99v6.71h-0.99v-6.71z" fill={subtitleColor} />
            <Path d="m126.9 148.6v6.71h-0.96v-4.97l-2.64 4.97h-0.6l-2.65-4.93v4.93h-0.96v-6.71h0.83l3.05 5.81 3.1-5.81h0.83z" fill={subtitleColor} />
            <Path d="m134.4 153.5h-4.04l-0.79 1.8h-0.96l3.21-6.71h0.97l3.37 6.71h-1.04l-0.72-1.8zm-0.35-0.79-1.73-3.61-1.65 3.61h3.38z" fill={subtitleColor} />
            <Path d="m138.6 148.6h1v5.92h3.69v0.79h-4.69v-6.71z" fill={subtitleColor} />
            <Path d="m146 148.6h1v6.71h-1v-6.71z" fill={subtitleColor} />
            <Path d="m149.3 154.6 0.4-0.79c0.67 0.5 1.57 0.79 2.57 0.79 1.23 0 1.87-0.45 1.87-1.15 0-1.75-4.44-0.59-4.44-3.24 0-1.06 1.21-1.79 2.72-1.79 0.88 0 1.68 0.26 2.33 0.65l-0.44 0.73c-0.61-0.42-1.33-0.65-2.04-0.65-1.06 0-1.71 0.5-1.71 1.14 0 1.76 4.44 0.56 4.44 3.08 0 1.15-1.06 1.96-2.82 1.96-1.13 0-2.27-0.35-2.88-0.73z" fill={subtitleColor} />
            <Path d="m158.4 149.4h-2.35v-0.79h5.7v0.79h-2.35v5.92h-1v-5.92z" fill={subtitleColor} />
            <Path d="m163.9 148.6h0.99v6.71h-0.99v-6.71z" fill={subtitleColor} />
            <Path d="m167.4 151.9c0-2.05 1.65-3.48 3.87-3.48 1.09 0 2.05 0.38 2.77 1.07l-0.69 0.56c-0.59-0.6-1.28-0.84-2.05-0.84-1.69 0-2.94 1.16-2.94 2.69s1.25 2.69 2.94 2.69c0.84 0 1.49-0.29 2.14-0.94l0.65 0.61c-0.74 0.74-1.7 1.12-2.82 1.12-2.22 0-3.87-1.48-3.87-3.48z" fill={subtitleColor} />
            <Path d="m181.2 148.6h1v6.71h-1v-6.71z" fill={subtitleColor} />
            <Path d="m190.8 148.6v6.71h-0.81l-4.15-5.4v5.4h-0.97v-6.71h0.8l4.16 5.4v-5.4h0.97z" fill={subtitleColor} />
            <Path d="m199.6 148.6-3.13 6.71h-0.96l-3.05-6.71h1.06l2.57 5.73 2.65-5.73h0.86z" fill={subtitleColor} />
            <Path d="m201.2 151.9c0-2.05 1.53-3.48 3.67-3.48 2.15 0 3.68 1.43 3.68 3.43s-1.53 3.53-3.68 3.53c-2.14 0-3.67-1.53-3.67-3.48zm6.39-0.05c0-1.53-1.16-2.64-2.72-2.64-1.6 0-2.71 1.16-2.71 2.64 0 1.53 1.16 2.74 2.71 2.74 1.53 0 2.72-1.21 2.72-2.74z" fill={subtitleColor} />
            <Path d="m211.1 148.6h1v6.71h-1v-6.71z" fill={subtitleColor} />
            <Path d="m214.6 151.9c0-2.05 1.53-3.48 3.75-3.48 1.09 0 2.05 0.38 2.69 1.07l-0.64 0.56c-0.57-0.6-1.26-0.84-2.05-0.84-1.69 0-2.85 1.16-2.85 2.69s1.16 2.69 2.85 2.69c0.84 0 1.48-0.29 2.13-0.94l0.65 0.61c-0.73 0.74-1.69 1.12-2.81 1.12-2.19 0-3.72-1.48-3.72-3.48z" fill={subtitleColor} />
            <Path d="m223.8 148.6h1v6.71h-1v-6.71z" fill={subtitleColor} />
            <Path d="m234.3 148.6v6.71h-0.81l-4.15-5.4v5.4h-0.97v-6.71h0.8l4.16 5.4v-5.4h0.97z" fill={subtitleColor} />
            <Path d="m242.8 151.9h0.91v2.52c-0.74 0.65-1.8 0.96-2.92 0.96-2.22 0-3.83-1.48-3.83-3.53s1.61-3.43 3.83-3.43c1.12 0 2.08 0.38 2.78 1.07l-0.61 0.56c-0.64-0.6-1.38-0.84-2.22-0.84-1.69 0-2.9 1.11-2.9 2.64s1.21 2.74 2.9 2.74c0.7 0 1.38-0.19 2.03-0.59l0.03-2.1z" fill={subtitleColor} />

            <Defs>
                <LinearGradient id="bl_paint0" x1="6.25" y1="124.6" x2="82.82" y2="124.6" gradientUnits="userSpaceOnUse">
                    <Stop stopColor={logoGradientColor} />
                    <Stop offset="1" stopColor={logoGradientColor} />
                </LinearGradient>
                <LinearGradient id="bl_paint1" x1="18.33" y1="114.4" x2="44.71" y2="114.4" gradientUnits="userSpaceOnUse">
                    <Stop stopColor={isLight ? '#FFFFFF' : logoGradientColor} />
                    <Stop offset="1" stopColor={isLight ? '#E0F2FE' : logoGradientColor} />
                </LinearGradient>
                <LinearGradient id="bl_paint2" x1="12.08" y1="121" x2="38.46" y2="121" gradientUnits="userSpaceOnUse">
                    <Stop stopColor={isLight ? '#FFFFFF' : logoGradientColor} />
                    <Stop offset="1" stopColor={isLight ? '#E0F2FE' : logoGradientColor} />
                </LinearGradient>
                <LinearGradient id="bl_paint3" x1="6.25" y1="128" x2="32.63" y2="128" gradientUnits="userSpaceOnUse">
                    <Stop stopColor={isLight ? '#FFFFFF' : logoGradientColor} />
                    <Stop offset="1" stopColor={isLight ? '#E0F2FE' : logoGradientColor} />
                </LinearGradient>
            </Defs>
        </Svg>
    );
};

export default BrandLockup;

