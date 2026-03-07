import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    Platform,
    PanResponder,
    Dimensions,
    StatusBar
} from 'react-native';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, BellRing } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const { width } = Dimensions.get('window');

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const showToast = useCallback((message, type = 'success', duration = 3500) => {
        const id = toastIdRef.current++;
        setToasts((prev) => {
            const current = [...prev, { id, message, type, duration }];
            // Max 2 toasts to keep it clean
            if (current.length > 2) return current.slice(current.length - 2);
            return current;
        });
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.container} pointerEvents="box-none">
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onRemove={() => removeToast(toast.id)}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove }) => {
    const { message, type, duration } = toast;
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;
    const progressWidth = useRef(new Animated.Value(100)).current;

    const timerRef = useRef(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy < 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -40) {
                    animateOut();
                } else {
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        friction: 8
                    }).start();
                }
            }
        })
    ).current;

    const animateOut = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.9,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => onRemove());
    };

    useEffect(() => {
        // Entrance
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 7,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                friction: 7,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();

        // Progress line animation
        Animated.timing(progressWidth, {
            toValue: 0,
            duration: duration,
            useNativeDriver: false,
        }).start();

        if (duration > 0) {
            timerRef.current = setTimeout(() => {
                animateOut();
            }, duration);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const getIcon = () => {
        switch (type) {
            case 'error': return <AlertCircle size={20} color="#000" strokeWidth={2.5} />;
            case 'warning': return <AlertTriangle size={20} color="#000" strokeWidth={2.5} />;
            case 'info': return <Info size={20} color="#000" strokeWidth={2.5} />;
            case 'success': return <CheckCircle2 size={20} color="#000" strokeWidth={2.5} />;
            case 'black': return <BellRing size={20} color="#000" strokeWidth={2.5} />;
            case 'stock': return <AlertTriangle size={20} color="#000" strokeWidth={2.5} />;
            default: return <BellRing size={20} color="#000" strokeWidth={2.5} />;
        }
    };

    const getStatusColor = () => {
        switch (type) {
            case 'error': return '#ff0000';
            case 'warning': return '#f59e0b';
            case 'success': return '#000000';
            case 'black': return '#000000';
            case 'stock': return '#000000';
            default: return '#000000';
        }
    };

    const isStockType = type === 'stock';

    return (
        <Animated.View
            style={[
                styles.toastWrapper,
                { opacity, transform: [{ translateY }, { scale }] }
            ]}
            {...panResponder.panHandlers}
        >
            <View style={styles.blurContainer}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        {getIcon()}
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={styles.messageText}>{message}</Text>
                    </View>

                    <TouchableOpacity onPress={animateOut} style={styles.closeBtn}>
                        <X size={16} color="#64748b" strokeWidth={3} />
                    </TouchableOpacity>

                    {/* Duration Progress Bar */}
                    <View style={styles.progressBackground}>
                        <Animated.View
                            style={[
                                styles.progressBar,
                                {
                                    width: progressWidth.interpolate({
                                        inputRange: [0, 100],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999999,
        paddingHorizontal: 20,
    },
    toastWrapper: {
        width: '100%',
        maxWidth: 420,
        marginBottom: 10,
    },
    blurContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 12,
        backgroundColor: '#fff',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 60,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
        borderColor: '#eee',
    },
    statusDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#fff',
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    messageText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: -0.3,
        lineHeight: 18,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#eee',
    },
    progressBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: '#f0f0f0',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#000',
    }
});

export default ToastProvider;
