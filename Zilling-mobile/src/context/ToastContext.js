import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Animated,
    StyleSheet,
    TouchableOpacity,
    Platform,
    PanResponder,
    Dimensions
} from 'react-native';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react-native';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const showToast = useCallback((message, type = 'success', duration = 4000) => {
        const id = toastIdRef.current++;
        // Limit to 3 toasts at a time to prevent clutter
        setToasts((prev) => {
            const current = [...prev, { id, message, type, duration }];
            if (current.length > 3) return current.slice(current.length - 3);
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
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.9)).current;

    // Timer ref to clear it if user interacts
    const timerRef = useRef(null);

    // PanResponder for swipe dismissal
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gestureState) => {
                // Determine drag direction (mostly vertical)
                if (gestureState.dy < 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy < -50) {
                    // Swiped up enough - dismiss
                    animateOut();
                } else {
                    // Snap back
                    Animated.spring(translateY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            }
        })
    ).current;

    const animateOut = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -50,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.8,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start(() => onRemove());
    };

    useEffect(() => {
        // Entrance Animation
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 6,
                tension: 50,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 50,
                useNativeDriver: true,
            })
        ]).start();

        // Auto Dismiss Timer
        if (duration > 0) {
            timerRef.current = setTimeout(() => {
                animateOut();
            }, duration);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const getToastConfig = () => {
        switch (type) {
            case 'error': return {
                icon: AlertCircle,
                bg: '#FEF2F2',
                border: '#FECACA',
                text: '#DC2626',
                title: 'Error'
            };
            case 'warning': return {
                icon: AlertTriangle,
                bg: '#FFFBEB',
                border: '#FDE68A',
                text: '#D97706',
                title: 'Warning'
            };
            case 'info': return {
                icon: Info,
                bg: '#EFF6FF',
                border: '#BFDBFE',
                text: '#2563EB',
                title: 'Info'
            };
            case 'success':
            default: return {
                icon: CheckCircle2,
                bg: '#F0FDF4',
                border: '#BBF7D0',
                text: '#16A34A',
                title: 'Success'
            };
        }
    };

    const config = getToastConfig();
    const Icon = config.icon;

    return (
        <Animated.View
            style={[
                styles.toastContainer,
                { opacity, transform: [{ translateY }, { scale }] }
            ]}
            {...panResponder.panHandlers}
        >
            <View style={[styles.card, { borderLeftColor: config.text }]}>
                <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                    <Icon size={22} color={config.text} strokeWidth={2.5} />
                </View>

                <View style={styles.contentBox}>
                    <Text style={[styles.title, { color: config.text }]}>{config.title}</Text>
                    <Text style={styles.message}>{message}</Text>
                </View>

                <TouchableOpacity
                    onPress={animateOut}
                    style={styles.closeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={18} color="#94a3b8" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 99999,
        paddingHorizontal: 16,
    },
    toastContainer: {
        width: '100%',
        maxWidth: 400,
        marginBottom: 12,
        shadowColor: '#64748b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Top align for multi-line
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderLeftWidth: 4,
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contentBox: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: 1, // Visual centering adjust
    },
    title: {
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 2,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    message: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '600',
        lineHeight: 20,
    },
    closeButton: {
        padding: 4,
        marginLeft: 8,
        marginTop: 2,
    }
});

export default ToastProvider;
