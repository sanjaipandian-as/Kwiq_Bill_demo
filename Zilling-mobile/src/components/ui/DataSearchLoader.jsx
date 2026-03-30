import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { DATA_SEARCH_LOADER_HTML } from './DataSearchLoaderHtml';

const { width, height } = Dimensions.get('window');

/**
 * DataSearchLoader
 * 
 * Props:
 *   stage   {number} 1-4  — current real progress stage from the parent
 *   onReady {function}    — called when the Stage 4 tick animation finishes (~1s after stage=4)
 */
const DataSearchLoader = ({ stage = 1, onReady }) => {
    const webViewRef = useRef(null);
    // Track whether WebView is ready to receive JS injections
    const webViewReady = useRef(false);
    // Buffer stage advances that arrive before the WebView is loaded
    const pendingStage = useRef(stage);

    const injectStage = (s) => {
        if (webViewRef.current && webViewReady.current) {
            webViewRef.current.injectJavaScript(`goToStage(${s}); true;`);
        }
    };

    // Advance stage every time the prop changes
    useEffect(() => {
        pendingStage.current = stage;
        injectStage(stage);
    }, [stage]);

    const handleLoad = () => {
        webViewReady.current = true;
        // Flush any stage that arrived before the WebView was ready
        injectStage(pendingStage.current);
    };

    const handleMessage = (event) => {
        if (event.nativeEvent.data === 'STAGE_DONE') {
            // Stage 4 tick animation has completed — tell the parent to navigate home
            if (onReady) onReady();
        }
    };

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                source={{ html: DATA_SEARCH_LOADER_HTML }}
                style={styles.webview}
                scrollEnabled={false}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                allowFileAccess={true}
                onLoad={handleLoad}
                onMessage={handleMessage}
                javaScriptEnabled={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
        width: width,
        height: height,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    }
});

export default DataSearchLoader;
