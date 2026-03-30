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
    StatusBar,
    Vibration,
    Image
} from 'react-native';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, BellRing, User, Contact, Printer, ShieldAlert, Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

const { width } = Dimensions.get('window');

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);

    const showToast = useCallback((message, type = 'success', duration = 3500, action = null, title = null, image = null) => {
        const id = toastIdRef.current++;
        setToasts((prev) => {
            const current = [...prev, { id, message, type, duration, action, title, image }];
            // Max 2 toasts to keep it clean
            if (current.length > 2) return current.slice(current.length - 2);
            return current;
        });

        // Haptic feedback
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            if (type === 'error' || type === 'customer') {
                Vibration.vibrate([0, 60, 100, 60]); // Error pattern
            } else if (type === 'warning' || type === 'stock') {
                Vibration.vibrate(80);
            } else {
                Vibration.vibrate(30); // Success/Info soft tap
            }
        }
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
    const { message, type, duration, action, title, image } = toast;
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

    const getTypeConfig = () => {
        switch (type) {
            case 'success': return {
                colors: ['#059669', '#10b981'],
                icon: <CheckCircle2 size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#34d399',
                title: 'SUCCESS'
            };
            case 'error': return {
                colors: ['#991b1b', '#ef4444'],
                icon: <AlertCircle size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#fca5a5',
                title: 'ERROR'
            };
            case 'warning':
            case 'stock': return {
                colors: ['#b45309', '#f59e0b'],
                icon: <AlertTriangle size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#fcd34d',
                title: type === 'stock' ? 'STOCK ALERT' : 'WARNING'
            };
            case 'trash': return {
                colors: ['#1e1e1e', '#ef4444'],
                icon: <Trash2 size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#ff8080',
                title: 'RECYCLE BIN'
            };
            case 'customer': return {
                colors: ['#5b21b6', '#8b5cf6'],
                icon: <User size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#ddd6fe',
                title: 'CUSTOMER'
            };
            case 'printer': return {
                colors: ['#0f172a', '#334155'],
                icon: <Printer size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#94a3b8',
                title: 'PRINTER'
            };
            case 'security': return {
                colors: ['#1e1e1e', '#000000'],
                icon: <ShieldAlert size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#ef4444',
                title: 'SECURITY'
            };
            case 'receptionist': return {
                colors: ['#065f46', '#059669'],
                icon: <Contact size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#a7f3d0',
                title: 'STAFF'
            };
            default: return {
                colors: ['#1e293b', '#475569'],
                icon: <BellRing size={20} color="#fff" strokeWidth={2.5} />,
                accent: '#cbd5e1',
                title: 'NOTIFICATION'
            };
        }
    };

    const config = getTypeConfig();
    const isDark = true; // All our new types are dark/vibrant

    return (
        <Animated.View
            style={[
                styles.toastWrapper,
                { opacity, transform: [{ translateY }, { scale }] }
            ]}
            {...panResponder.panHandlers}
        >
            <LinearGradient 
                colors={config.colors} 
                start={{x: 0, y: 0}} 
                end={{x: 1, y: 0}}
                style={styles.premiumBlurContainer}
            >
                <View style={styles.content}>
                    <View style={styles.iconContainerPremium}>
                        {image ? (
                            <Image source={typeof image === 'string' ? { uri: image } : image} style={{ width: 34, height: 34, borderRadius: 8 }} />
                        ) : (
                            config.icon
                        )}
                        <View style={[styles.statusDotPremium, { backgroundColor: config.accent }]} />
                    </View>

                    <View style={styles.textContainer}>
                        <Text style={[styles.titleTextPremium, { color: config.accent }]}>
                            {title || config.title}
                        </Text>
                        <Text style={styles.messageTextPremium}>{message}</Text>
                        
                        {action && (
                            <TouchableOpacity
                                 onPress={() => {
                                    if (Platform.OS !== 'web') Vibration.vibrate(40);
                                    action.onPress();
                                    animateOut();
                                }}
                                style={styles.actionBtnPremium}
                            >
                                <Text style={[styles.actionBtnTextPremium, { color: config.colors[1] }]}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity onPress={animateOut} style={styles.closeBtnPremium}>
                        <X size={14} color="rgba(255,255,255,0.6)" strokeWidth={3} />
                    </TouchableOpacity>

                    {/* Duration Progress Bar */}
                    <View style={styles.progressBackgroundPremium}>
                        <Animated.View
                            style={[
                                styles.progressBarPremium,
                                {
                                    backgroundColor: config.accent,
                                    width: progressWidth.interpolate({
                                        inputRange: [0, 100],
                                        outputRange: ['0%', '100%']
                                    })
                                }
                            ]}
                        />
                    </View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight || 24) + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999999,
        paddingHorizontal: 16,
    },
    toastWrapper: {
        width: '100%',
        maxWidth: 400,
        marginBottom: 8,
    },
    premiumBlurContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        minHeight: 70,
    },
    iconContainerPremium: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    statusDotPremium: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.3)',
    },
    textContainer: {
        flex: 1,
        marginRight: 8,
    },
    titleTextPremium: {
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: 2,
        opacity: 0.9,
    },
    messageTextPremium: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
        lineHeight: 18,
    },
    closeBtnPremium: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnPremium: {
        marginTop: 10,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    actionBtnTextPremium: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    progressBackgroundPremium: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    progressBarPremium: {
        height: '100%',
        opacity: 0.6,
    }
});

export default ToastProvider;
