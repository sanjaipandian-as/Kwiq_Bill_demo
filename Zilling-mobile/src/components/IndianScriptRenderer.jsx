import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import ProfessionalThermalTemplate from '../pages/Settings/ProfessionalThermalTemplate';
import ThermalInvoiceTemplate from '../pages/Settings/ThermalInvoiceTemplate';

const IndianScriptRenderer = forwardRef((props, ref) => {
    const viewShotRef = useRef(null);
    const [renderData, setRenderData] = useState({ type: 'text', text: '', width: 576, fontSize: 24, font: 'NotoSansTamil' });
    const [isRendering, setIsRendering] = useState(false);
    const timersRef = useRef([]);

    useEffect(() => {
        return () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, []);

    useImperativeHandle(ref, () => ({
        renderTextToImage: async (text, width = 576, fontSize = 24, font = 'NotoSansTamil') => {
            return new Promise((resolve) => {
                setRenderData({ type: 'text', text, width, fontSize, font });
                setIsRendering(true);

                const timerId = setTimeout(async () => {
                    try {
                        if (viewShotRef.current) {
                            const uri = await viewShotRef.current.capture();
                            resolve(uri);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[IndianScriptRenderer] Capture failed:', error);
                        resolve(null);
                    } finally {
                        setIsRendering(false);
                    }
                }, 300);
                timersRef.current.push(timerId);
            });
        },
        renderSupportQRs: async (width = 576) => {
            return new Promise((resolve) => {
                setRenderData({ type: 'support-qrs', width });
                setIsRendering(true);

                // Give it 1.2s to fully load network images before snap
                const timerId = setTimeout(async () => {
                    try {
                        if (viewShotRef.current) {
                            const uri = await viewShotRef.current.capture();
                            resolve(uri);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[IndianScriptRenderer] QR Capture failed:', error);
                        resolve(null);
                    } finally {
                        setIsRendering(false);
                    }
                }, 1200);
                timersRef.current.push(timerId);
            });
        },
        renderSingleQR: async (title, qrData, width = 576) => {
            return new Promise((resolve) => {
                setRenderData({ type: 'single-qr', title, qrData, width });
                setIsRendering(true);

                // Faster load for single QR
                const timerId = setTimeout(async () => {
                    try {
                        if (viewShotRef.current) {
                            const uri = await viewShotRef.current.capture();
                            resolve(uri);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[IndianScriptRenderer] Single QR Capture failed:', error);
                        resolve(null);
                    } finally {
                        setIsRendering(false);
                    }
                }, 800);
                timersRef.current.push(timerId);
            });
        },
        renderBillToImage: async (bill, settings, isDetailedFormat = true, width = 576) => {
            return new Promise((resolve) => {
                setRenderData({ type: 'bill', bill, settings, isDetailedFormat, width });
                setIsRendering(true);

                // Need enough time for the React tree to fully lay out and calculate heights
                const timerId = setTimeout(async () => {
                    try {
                        if (viewShotRef.current) {
                            const uri = await viewShotRef.current.capture();
                            resolve(uri);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        console.error('[IndianScriptRenderer] Bill Capture failed:', error);
                        resolve(null);
                    } finally {
                        setIsRendering(false);
                    }
                }, 1000);
                timersRef.current.push(timerId);
            });
        }
    }));

    if (!isRendering) return null;

    return (
        <View style={styles.hiddenContainer}>
            <ViewShot
                ref={viewShotRef}
                options={{ format: 'png', result: 'base64', quality: 1.0 }}
                style={{ width: renderData.type === 'bill' ? 300 : renderData.width, backgroundColor: 'white' }}
            >
                {renderData.type === 'text' ? (
                    <View style={[styles.renderer, { width: renderData.width }]}>
                        <Text
                            style={[
                                styles.text,
                                {
                                    fontSize: renderData.fontSize,
                                    fontFamily: renderData.font,
                                    width: renderData.width
                                }
                            ]}
                        >
                            {renderData.text}
                        </Text>
                    </View>
                ) : renderData.type === 'support-qrs' ? (
                    <View style={{ width: renderData.width, backgroundColor: 'white', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.qrHeader}>WHATSAPP</Text>
                            <QRCode value="https://wa.me/917558175156" size={140} />
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.qrHeader}>CALL</Text>
                            <QRCode value="tel:+917558175156" size={140} />
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.qrHeader}>EMAIL</Text>
                            <QRCode value="mailto:support@kwiqbill.com" size={140} />
                        </View>
                    </View>
                ) : renderData.type === 'single-qr' ? (
                    <View style={{ width: renderData.width, backgroundColor: 'white', paddingVertical: 15, alignItems: 'center' }}>
                        <Text style={[styles.qrHeader, { fontSize: 24, marginBottom: 12 }]}>{renderData.title}</Text>
                        <QRCode value={renderData.qrData || ' '} size={160} />
                    </View>
                ) : renderData.type === 'bill' ? (
                    <View style={{ width: 300, backgroundColor: 'white', padding: 0 }}>
                        {renderData.isDetailedFormat ? (
                            <ProfessionalThermalTemplate settings={renderData.settings} data={{ ...renderData.bill, items: renderData.bill.cart || renderData.bill.items, invoiceNo: renderData.bill.weekly_sequence || renderData.bill.id, mode: 'invoice' }} />
                        ) : (
                            <ThermalInvoiceTemplate settings={renderData.settings} data={{ ...renderData.bill, items: renderData.bill.cart || renderData.bill.items, invoiceNo: renderData.bill.weekly_sequence || renderData.bill.id }} />
                        )}
                    </View>
                ) : null}
            </ViewShot>
        </View>
    );
});

const styles = StyleSheet.create({
    hiddenContainer: {
        position: 'absolute',
        top: -9999,
        left: -9999,
    },
    renderer: {
        backgroundColor: 'white',
        padding: 0,
    },
    text: {
        color: 'black',
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    qrHeader: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'black',
        marginBottom: 8,
        letterSpacing: 1
    }
});

export default IndianScriptRenderer;
