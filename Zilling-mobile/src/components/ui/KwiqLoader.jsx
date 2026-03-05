import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const KwiqLoader = ({ size = 112, color = '#0F172A' }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(anim, {
                toValue: 100,
                duration: 4000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false, // width/height/margin don't support native driver
            })
        ).start();
    }, []);

    // Scale factor based on the original 112px design
    const s = size / 112;

    // Keyframes for Box 1
    const b1Width = anim.interpolate({
        inputRange: [0, 12.5, 75, 100],
        outputRange: [112 * s, 48 * s, 48 * s, 48 * s],
    });
    const b1Height = anim.interpolate({
        inputRange: [0, 62.5, 75, 87.5, 100],
        outputRange: [48 * s, 48 * s, 112 * s, 48 * s, 48 * s],
    });
    const b1MT = anim.interpolate({
        inputRange: [0, 62.5, 75, 87.5, 100],
        outputRange: [64 * s, 64 * s, 0, 0, 0],
    });
    const b1ML = anim.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 0],
    });

    // Keyframes for Box 2
    const b2Width = anim.interpolate({
        inputRange: [0, 37.5, 50, 62.5, 100],
        outputRange: [48 * s, 48 * s, 112 * s, 48 * s, 48 * s],
    });
    const b2Height = anim.interpolate({
        inputRange: [0, 100],
        outputRange: [48 * s, 48 * s],
    });
    const b2MT = anim.interpolate({
        inputRange: [0, 100],
        outputRange: [0, 0],
    });
    const b2ML = anim.interpolate({
        inputRange: [0, 50, 62.5, 100],
        outputRange: [0, 0, 64 * s, 64 * s],
    });

    // Keyframes for Box 3
    const b3Width = anim.interpolate({
        inputRange: [0, 87.5, 100],
        outputRange: [48 * s, 48 * s, 112 * s],
    });
    const b3Height = anim.interpolate({
        inputRange: [0, 12.5, 25, 37.5, 100],
        outputRange: [48 * s, 48 * s, 112 * s, 48 * s, 48 * s],
    });
    const b3MT = anim.interpolate({
        inputRange: [0, 25, 37.5, 100],
        outputRange: [0, 0, 64 * s, 64 * s],
    });
    const b3ML = anim.interpolate({
        inputRange: [0, 87.5, 100],
        outputRange: [64 * s, 64 * s, 0],
    });

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Animated.View
                style={[
                    styles.box,
                    {
                        borderColor: color,
                        borderWidth: 16 * s,
                        width: b1Width,
                        height: b1Height,
                        marginTop: b1MT,
                        marginLeft: b1ML,
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.box,
                    {
                        borderColor: color,
                        borderWidth: 16 * s,
                        width: b2Width,
                        height: b2Height,
                        marginTop: b2MT,
                        marginLeft: b2ML,
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.box,
                    {
                        borderColor: color,
                        borderWidth: 16 * s,
                        width: b3Width,
                        height: b3Height,
                        marginTop: b3MT,
                        marginLeft: b3ML,
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    box: {
        position: 'absolute',
        backgroundColor: 'transparent',
    },
});

export default KwiqLoader;
