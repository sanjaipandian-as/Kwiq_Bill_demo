import Svg, { Path, G } from 'react-native-svg';

/**
 * BrandLockup Component
 * Renders the primary brand identity for Kwiq Bill.
 * Focused on high visibility and modern aesthetic.
 */
const BrandLockup = ({ width = 250, height = 60, style, variant = 'dark' }) => {
    const isLight = variant === 'light';

    // Premium Color Palette
    const colors = {
        kwiq: isLight ? '#FFFFFF' : '#0F172A',
        bill: '#FFFFFF', // Requested bill text to be white
        subtitle: isLight ? 'rgba(255,255,255,0.8)' : '#64748B',
        logo: isLight ? '#FFFFFF' : '#0EA5E9', // Solid logo color (No gradient)
    };

    return (
        <Svg
            width={width}
            height={height}
            // Decreased size relative to container by expanding viewBox bounds (-20 to 280)
            // Added padding top by starting Y at 65 (content starts at ~97)
            viewBox="-15 65 280 115"
            fill="none"
            style={style}
            preserveAspectRatio="xMidYMid meet"
        >
            {/* Logo Icon Mark */}
            <Path
                d="m5.46 108.2 11.06-11.52v11.52h-11.06z"
                fill={colors.logo}
            />
            <Path
                d="m5.46 110.1v36.54c19.28-8.94 30.23-18.34 53.42-37.5l-2.53-1.07 12.01-4.57-5.57 13.22-1.76-3.89c-14.92 14.27-30.29 27.15-55.57 40.4 13.21-3.97 23.45-8.46 33.65-15.94l16.66 15.71h22.49l-24.55-26.18 28.71-30.1h-22.06l-25.33 22.17v-22.17h-16.24v13.38h-13.33zm5.75 9.39h14.26v2.73h-14.26v-2.73zm0 5.66h11.45v2.27h-11.45v-2.27z"
                fill={colors.logo}
            />
            <G transform="translate(5, -4)">
                {/* "KWIQ" Text Section */}
                <Path fill={colors.kwiq} d="m83.68 107.2v19.62h4.63v-5.11l2.48-2.78 6.5 7.89h6.12l-8.85-10.89 7.57-8.73h-4.95l-8.5 10v-10h-5z" />
                <Path fill={colors.kwiq} d="m103.1 107.2 5.93 19.23h5.52l4.35-12.98 4.35 12.98h4.6l5.92-19.23h-4.33l-4.09 13.61-4.62-13.87h-3.48l-4.97 13.73-4.21-13.47z" />
                <Path fill={colors.kwiq} d="m136.5 107.2v19.45h5.18v-19.45h-5.18z" />
                <Path fill={colors.kwiq} d="m156.4 106.8c-7.35 0-11.06 5.41-11.06 10.49 0 5.06 3.36 9.07 8.76 9.65 2.81 2.26 4.59 3.24 7.49 3.24 2.6 0 4.45-0.77 6.57-2.26l-1.46-2.92c-0.98 0.85-2.3 1.3-3.66 1.3-1.13 0-2.28-0.43-3.34-1.2 5.21-1.3 7.4-5.5 7.4-8.84 0-4.93-3.53-9.46-10.7-9.46zm-0.17 3.98c4.56 0 6.19 3.27 6.19 6.34 0 3.39-2.51 6.08-6.19 6.08-4.18 0-6.27-3.07-6.27-6.14 0-3.09 2.03-6.28 6.27-6.28z" />
                {/* "BILL" Text Section - White */}
                <Path fill={colors.bill} d="m179.5 107.2v19.62h10.21c5.99 0 7.68-2.26 7.68-5.81 0-2.02-1.13-3.51-2.94-4.31 1.41-0.95 1.99-2.35 1.99-3.79 0-3.01-1.63-5.71-6.97-5.71h-9.97zm4.63 3.45h5.66c1.81 0 2.3 1.2 2.3 2.31 0 0.95-0.83 2-1.99 2h-5.97v-4.31zm0 7.44h6.44c1.72 0 2.33 1.08 2.33 2.34 0 1.17-0.58 2.67-3 2.67h-5.77v-5.01z" />
                <Path fill={colors.bill} d="m201.7 107.2v19.45h4.63v-19.45h-4.63z" />
                <Path fill={colors.bill} d="m211.3 107.2v19.45h15.37v-3.89h-10.74v-15.56h-4.63z" />
                <Path fill={colors.bill} d="m229.6 107.2v19.45h14.71v-3.89h-9.74v-15.56h-4.97z" />
            </G>
            {/* Subtitle Section */}
            <G transform="translate(-12, -45) scale(1.2, 1.35)">
                <Path fill={colors.subtitle} d="m83.71 135.4v8.49h1.81v-5.09l2.6 4.8h0.99l2.8-4.9v5.19h1.81v-8.49h-1.4l-3.49 6.21-3.41-6.21h-1.71z" />
                <Path fill={colors.subtitle} d="m95.09 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m98.88 135.4v8.31h1.89v-5.36l4.44 5.36h1.58v-8.31h-1.77v5.77l-4.63-5.77h-1.51z" />
                <Path fill={colors.subtitle} d="m108.2 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m112 135.4v8.49h1.81v-5.09l2.6 4.8h0.99l2.8-4.9v5.19h1.81v-8.49h-1.4l-3.49 6.21-3.41-6.21h-1.71z" />
                <Path fill={colors.subtitle} d="m122.1 143.7h2.05l0.77-2.17h3.56l0.83 2.17h2.05l-3.71-8.62h-1.69l-3.86 8.62zm3.35-3.53 1.23-3.29 1.27 3.29h-2.5z" />
                <Path fill={colors.subtitle} d="m131.2 135.4v8.31h6.89v-1.69h-4.77v-6.62h-2.12z" />
                <Path fill={colors.subtitle} d="m139 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m141.9 137.9c0 1.55 1.17 2.3 2.84 2.56l1.06 0.18c0.75 0.13 1.35 0.35 1.35 0.95 0 0.57-0.64 0.9-1.81 0.9-1.16 0-2.23-0.42-2.93-0.9l-0.76 1.61c0.8 0.57 2.12 1 3.71 1 2.32 0 3.52-1.14 3.52-2.69 0-1.4-1.22-2.15-2.85-2.44l-0.95-0.18c-0.88-0.18-1.37-0.43-1.37-1.02 0-0.48 0.54-0.82 1.69-0.82 1.03 0 2.01 0.39 2.66 0.82l0.85-1.55c-1.06-0.68-2.2-1.02-3.58-1.02-2.13 0-3.43 1.17-3.43 2.6z" />
                <Path fill={colors.subtitle} d="m148.7 135.4v1.59h2.8v6.72h2.05v-6.72h2.8v-1.59h-7.65z" />
                <Path fill={colors.subtitle} d="m157 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m160 139.7c0 2.69 1.65 4.28 4.56 4.28 1.81 0 2.95-0.68 3.71-1.45l-1.06-1.45c-0.69 0.77-1.54 1.31-2.6 1.31-1.81 0-2.8-1.1-2.8-2.84 0-1.59 1.04-2.75 2.7-2.75 1.04 0 1.86 0.54 2.54 1.26l1.07-1.45c-1.02-1.01-2.16-1.48-3.66-1.48-2.96 0-4.46 2.08-4.46 4.57z" />
                <Path fill={colors.subtitle} d="m172.9 135v8.73h1.92v-8.73h-1.92z" />
                <Path fill={colors.subtitle} d="m176.5 135.4v8.31h1.89v-5.36l4.44 5.36h1.58v-8.31h-1.77v5.77l-4.63-5.77h-1.51z" />
                <Path fill={colors.subtitle} d="m185.1 135.4 3.76 8.49h1.14l4-8.49h-2.04l-2.66 6.24-2.55-6.24h-1.65z" />
                <Path fill={colors.subtitle} d="m193.7 139.5c0 2.56 1.71 4.43 4.37 4.43 2.85 0 4.4-2.15 4.4-4.53 0-2.42-1.66-4.32-4.3-4.32-2.8 0-4.47 2.1-4.47 4.42zm1.81-0.05c0-1.62 0.99-2.83 2.54-2.83 1.69 0 2.61 1.32 2.61 2.91 0 1.56-1.01 2.86-2.56 2.86-1.69 0-2.59-1.35-2.59-2.94z" />
                <Path fill={colors.subtitle} d="m203.9 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m206.9 139.7c0 2.69 1.65 4.28 4.56 4.28 1.81 0 2.95-0.68 3.71-1.45l-1.06-1.45c-0.69 0.77-1.54 1.31-2.6 1.31-1.81 0-2.8-1.1-2.8-2.84 0-1.59 1.04-2.75 2.7-2.75 1.04 0 1.86 0.54 2.54 1.26l1.07-1.45c-1.02-1.01-2.16-1.48-3.66-1.48-2.96 0-4.46 2.08-4.46 4.57z" />
                <Path fill={colors.subtitle} d="m216.3 135.4v8.31h1.99v-8.31h-1.99z" />
                <Path fill={colors.subtitle} d="m220.1 135.4v8.31h1.89v-5.36l4.44 5.36h1.58v-8.31h-1.77v5.77l-4.63-5.77h-1.51z" />
                <Path fill={colors.subtitle} d="m229.4 139.6c0 2.59 1.55 4.33 4.4 4.33 1.36 0 2.63-0.46 3.7-1.14v-3.98h-3.39v1.4h1.81v1.72c-0.64 0.33-1.23 0.49-1.91 0.49-1.81 0-2.8-1.23-2.8-2.97 0-1.69 1.14-2.83 2.8-2.83 1.04 0 1.94 0.54 2.62 1.16l0.96-1.4c-1.11-0.96-2.26-1.35-3.76-1.35-2.95 0-4.43 2.08-4.43 4.57z" />
            </G>
        </Svg>
    );
};

export default BrandLockup;
