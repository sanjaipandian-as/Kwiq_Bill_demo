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
            case 'error': return <AlertCircle size={20} color="#ef4444" strokeWidth={2.5} />;
            case 'warning': return <AlertTriangle size={20} color="#f59e0b" strokeWidth={2.5} />;
            case 'info': return <Info size={20} color="#3b82f6" strokeWidth={2.5} />;
            case 'success': return <CheckCircle2 size={20} color="#10b981" strokeWidth={2.5} />;
            case 'stock': return <AlertTriangle size={20} color="#000" strokeWidth={2.5} />;
            default: return <BellRing size={20} color="#3b82f6" strokeWidth={2.5} />;
        }
    };

    const getStatusColor = () => {
        // Subtle status pill color
        switch (type) {
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'success': return '#10b981';
            case 'stock': return '#000000';
            default: return '#3b82f6';
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
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Solid white fallback with slight transparency
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 64,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#f1f5f9', // Soft light gray background for icon
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    statusDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#fff', // White border on white background
    },
    textContainer: {
        flex: 1,
        marginRight: 10,
    },
    messageText: {
        color: '#0f172a', // Dark text
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.2,
        lineHeight: 20,
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    progressBar: {
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.15)',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    }
});

export default ToastProvider;
