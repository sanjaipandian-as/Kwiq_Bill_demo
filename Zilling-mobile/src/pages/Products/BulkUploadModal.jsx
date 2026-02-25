import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Modal,
    Alert,
    ActivityIndicator,
    Animated,
    Platform,
    Share
} from 'react-native';
import {
    X, Upload, Download, FileSpreadsheet, CheckCircle2,
    AlertCircle, Clock, Package, ChevronRight, File,
    ArrowUpCircle, Zap, Info, Layers
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

// ── Product-level template columns (variants are dynamic & unlimited) ──
const TEMPLATE_COLUMNS = [
    { key: 'name', label: 'Product Name', required: true, example: 'Premium Basmati Rice' },
    { key: 'sku', label: 'SKU / Barcode', required: true, example: 'SKU-10001' },
    { key: 'category', label: 'Category', required: false, example: 'Groceries' },
    { key: 'brand', label: 'Brand', required: false, example: 'Tata' },
    { key: 'costPrice', label: 'Cost Price (₹)', required: false, example: '120' },
    { key: 'sellingPrice', label: 'Selling Price (₹)', required: true, example: '150' },
    { key: 'stock', label: 'Stock Qty', required: false, example: '50' },
    { key: 'minStock', label: 'Low Stock Level', required: false, example: '10' },
    { key: 'unit', label: 'Unit', required: false, example: 'kg' },
    { key: 'taxRate', label: 'Tax Rate (%)', required: false, example: '5' },
];

// Template includes 3 example variant sets; users can add unlimited columns
const TEMPLATE_VARIANT_EXAMPLES = 3;

const BulkUploadModal = ({ visible, onClose, onImport }) => {
    const [step, setStep] = useState('template'); // 'template' | 'uploading' | 'preview' | 'importing' | 'success'
    const [parsedData, setParsedData] = useState([]);
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [importProgress, setImportProgress] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [processedItems, setProcessedItems] = useState(0);
    const [startTime, setStartTime] = useState(null);
    const [estimatedTime, setEstimatedTime] = useState('Calculating...');
    const [fileName, setFileName] = useState('');

    const progressAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (step === 'uploading' || step === 'importing') {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [step]);

    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: step === 'importing' ? importProgress : uploadProgress,
            duration: 300,
            useNativeDriver: false,
        }).start();
    }, [uploadProgress, importProgress, step]);

    const resetState = useCallback(() => {
        setStep('template');
        setParsedData([]);
        setErrors([]);
        setLoading(false);
        setUploadProgress(0);
        setImportProgress(0);
        setTotalItems(0);
        setProcessedItems(0);
        setStartTime(null);
        setEstimatedTime('Calculating...');
        setFileName('');
        progressAnim.setValue(0);
    }, []);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const formatTime = (seconds) => {
        if (seconds < 0 || !isFinite(seconds)) return 'Calculating...';
        if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return `~${mins}m ${secs}s remaining`;
    };

    const updateETA = (processed, total, start) => {
        if (processed === 0) return;
        const elapsed = (Date.now() - start) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        setEstimatedTime(formatTime(remaining));
    };

    // ── Generate & Download Template ──
    const handleDownloadTemplate = async () => {
        try {
            // Product headers + N variant sets (Detail, Price, Stock)
            const headers = TEMPLATE_COLUMNS.map(c => c.label);
            const exampleRow = TEMPLATE_COLUMNS.map(c => c.example);

            // Add variant columns for the template (3 example sets)
            const variantExamples = [
                { detail: 'Red', price: '160', stock: '25' },
                { detail: 'Blue', price: '170', stock: '15' },
                { detail: 'Green', price: '155', stock: '20' },
            ];
            for (let i = 0; i < TEMPLATE_VARIANT_EXAMPLES; i++) {
                headers.push(`Variant ${i + 1} Detail`, `Variant ${i + 1} Price (₹)`, `Variant ${i + 1} Stock`);
                const ex = variantExamples[i] || { detail: '', price: '', stock: '' };
                exampleRow.push(ex.detail, ex.price, ex.stock);
            }

            const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');

            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const fileUri = FileSystem.cacheDirectory + 'Kwiq_Product_Template.xlsx';
            await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Save Product Template',
                    UTI: 'com.microsoft.excel.xlsx'
                });
            } else {
                Alert.alert('Saved', 'Template generated. Check your downloads.');
            }
        } catch (err) {
            console.error('Template Error:', err);
            Alert.alert('Error', 'Failed to generate template file.');
        }
    };

    // ── File Pick & Parse ──
    const handleFilePick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/json',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv',
                    'text/comma-separated-values',
                ],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            setStep('uploading');
            setUploadProgress(0);
            setStartTime(Date.now());

            const asset = result.assets ? result.assets[0] : result;
            const fileUri = asset.uri;
            const fName = asset.name || 'uploaded_file';
            setFileName(fName);

            // Simulate upload parsing progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + Math.random() * 15;
                });
            }, 200);

            setTimeout(async () => {
                try {
                    let data = [];
                    const lowerName = fName.toLowerCase();

                    if (lowerName.endsWith('.json')) {
                        const fileContent = await FileSystem.readAsStringAsync(fileUri);
                        try {
                            data = JSON.parse(fileContent);
                        } catch (e) {
                            clearInterval(progressInterval);
                            Alert.alert('Error', 'Invalid JSON file');
                            setStep('template');
                            return;
                        }
                    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
                        try {
                            let workbook;
                            if (lowerName.endsWith('.csv')) {
                                const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });
                                workbook = XLSX.read(fileContent, { type: 'string' });
                            } else {
                                const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'base64' });
                                workbook = XLSX.read(fileContent, { type: 'base64' });
                            }

                            const firstSheetName = workbook.SheetNames[0];
                            const sheet = workbook.Sheets[firstSheetName];
                            const rawData = XLSX.utils.sheet_to_json(sheet);

                            // Normalize & map data matching ProductDrawer form fields
                            data = rawData.map(row => {
                                const rowKeys = Object.keys(row);
                                const normalizedRow = {};
                                rowKeys.forEach(key => {
                                    const cleanKey = key.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
                                    normalizedRow[cleanKey] = row[key];
                                });

                                const getVal = (possibleKeys) => {
                                    for (let k of possibleKeys) {
                                        const cleanSearch = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                                        if (normalizedRow[cleanSearch] !== undefined) return normalizedRow[cleanSearch];
                                    }
                                    return undefined;
                                };

                                // Dynamically detect unlimited variant columns
                                const variants = [];
                                let vi = 1;
                                while (true) {
                                    const vDetail = getVal([`variant${vi}detail`, `v${vi}detail`, `variant${vi}name`, `variant${vi}`]);
                                    const vPrice = getVal([`variant${vi}price`, `v${vi}price`, `variant${vi}pricers`]);
                                    const vStock = getVal([`variant${vi}stock`, `v${vi}stock`, `variant${vi}qty`]);

                                    // Stop when no variant detail is found
                                    if (vDetail === undefined && vPrice === undefined && vStock === undefined) break;

                                    if (vDetail && vDetail.toString().trim() !== '') {
                                        variants.push({
                                            name: vDetail.toString().trim(),
                                            options: [vDetail.toString().trim()],
                                            price: vPrice !== undefined ? parseFloat(vPrice) : null,
                                            stock: vStock !== undefined ? parseInt(vStock) : 0,
                                            sku: `SKU-${Date.now()}-v${vi}`,
                                        });
                                    }
                                    vi++;
                                }

                                return {
                                    name: getVal(['name', 'productname', 'itemname', 'item', 'description', 'title', 'product']) || '',
                                    sku: getVal(['sku', 'barcode', 'code', 'skubarcode', 'id', 'productid', 'itemcode']) || '',
                                    category: getVal(['category', 'group', 'department', 'cat', 'type']) || 'General',
                                    brand: getVal(['brand', 'manufacturer', 'company', 'make']) || '',
                                    price: getVal(['price', 'sellingprice', 'mrp', 'rate', 'amount', 'unitprice', 'salesprice']),
                                    costPrice: getVal(['costprice', 'cost', 'purchaseprice', 'buyprice', 'wholesaleprice']) || 0,
                                    stock: getVal(['stock', 'qty', 'quantity', 'inventory', 'balance', 'count', 'stockqty']) || 0,
                                    minStock: getVal(['minstock', 'lowstocklevel', 'lowstock', 'reorderlevel', 'minimumstock', 'minstockqty']) || 0,
                                    unit: getVal(['unit', 'uom', 'measurement']) || 'pcs',
                                    taxRate: getVal(['tax', 'taxrate', 'gst', 'vat', 'taxpercentage']) || 0,
                                    variants,
                                };
                            });
                        } catch (e) {
                            clearInterval(progressInterval);
                            console.error('File Parse Error:', e);
                            Alert.alert('Error', 'Failed to parse file. ' + (e.message || ''));
                            setStep('template');
                            return;
                        }
                    } else {
                        clearInterval(progressInterval);
                        Alert.alert('Error', 'Unsupported file type. Use .xlsx, .csv, or .json');
                        setStep('template');
                        return;
                    }

                    clearInterval(progressInterval);
                    setUploadProgress(100);

                    // Validate data
                    const validationErrors = [];
                    const validData = [];

                    data.forEach((item, index) => {
                        const rowErrors = [];
                        if (!item.name || item.name.trim() === '') {
                            rowErrors.push(`Row ${index + 1}: Missing product name`);
                        }
                        if (!item.sku || item.sku.toString().trim() === '') {
                            // Auto-generate SKU
                            item.sku = `SKU-${Date.now()}-${index}`;
                        }
                        if (item.price === undefined || item.price === null || item.price === '') {
                            rowErrors.push(`Row ${index + 1}: Missing selling price for "${item.name || 'Unknown'}"`);
                        }

                        if (rowErrors.length > 0) {
                            validationErrors.push(...rowErrors);
                        } else {
                            validData.push(item);
                        }
                    });

                    setTimeout(() => {
                        setParsedData(validData);
                        setErrors(validationErrors);
                        setTotalItems(validData.length);
                        setStep('preview');
                    }, 400);

                } catch (err) {
                    clearInterval(progressInterval);
                    console.error('Import error:', err);
                    Alert.alert('Error', 'Failed to process file.');
                    setStep('template');
                }
            }, 100);

        } catch (err) {
            console.error('Pick error:', err);
            Alert.alert('Error', 'Failed to pick file.');
            setStep('template');
        }
    };

    // ── Import with Progress ──
    const handleConfirmImport = async () => {
        if (parsedData.length === 0) return;

        setStep('importing');
        setImportProgress(0);
        setProcessedItems(0);
        const start = Date.now();
        setStartTime(start);
        setEstimatedTime('Calculating...');

        try {
            const total = parsedData.length;
            const BATCH_SIZE = 20;
            const batches = [];

            for (let i = 0; i < total; i += BATCH_SIZE) {
                batches.push(parsedData.slice(i, i + BATCH_SIZE));
            }

            let processed = 0;
            for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
                const batch = batches[batchIdx];

                // Map data to format expected by importProducts
                const mappedBatch = batch.map(item => {
                    const parsedVariants = (item.variants || []).map(v => ({
                        name: v.name || '',
                        options: v.options || [v.name || ''],
                        price: v.price !== null && v.price !== undefined ? parseFloat(v.price) : null,
                        stock: parseInt(v.stock || 0),
                        sku: v.sku || `SKU-${Date.now()}`,
                    }));

                    // If variants exist, auto-sum variant stocks as total stock
                    const variantTotalStock = parsedVariants.length > 0
                        ? parsedVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
                        : parseInt(item.stock || 0);

                    return {
                        name: item.name,
                        sku: item.sku,
                        barcode: item.sku,
                        category: item.category || 'General',
                        brand: item.brand || '',
                        price: parseFloat(item.price || 0),
                        sellingPrice: parseFloat(item.price || 0),
                        costPrice: parseFloat(item.costPrice || 0),
                        cost_price: parseFloat(item.costPrice || 0),
                        stock: variantTotalStock,
                        minStock: parseInt(item.minStock || 0),
                        min_stock: parseInt(item.minStock || 0),
                        unit: item.unit || 'pcs',
                        taxRate: parseFloat(item.taxRate || 0),
                        tax_rate: parseFloat(item.taxRate || 0),
                        variant: parsedVariants.length > 0 ? parsedVariants[0].name : '',
                        variants: parsedVariants,
                    };
                });

                await onImport(mappedBatch);

                processed += batch.length;
                setProcessedItems(processed);
                const progress = (processed / total) * 100;
                setImportProgress(progress);
                updateETA(processed, total, start);

                // Small delay between batches for UI
                if (batchIdx < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            setImportProgress(100);
            setEstimatedTime('Complete!');

            setTimeout(() => {
                setStep('success');
            }, 600);

        } catch (err) {
            console.error('Bulk import error:', err);
            Alert.alert('Error', 'Failed to import products. Some may have been added.');
            setStep('preview');
        }
    };

    // ── Progress Bar Component ──
    const ProgressBar = ({ progress, label, eta }) => {
        const widthInterpolation = progressAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
        });

        return (
            <View style={s.progressContainer}>
                <View style={s.progressHeader}>
                    <Text style={s.progressLabel}>{label}</Text>
                    <Text style={s.progressPercent}>{Math.round(progress)}%</Text>
                </View>
                <View style={s.progressTrack}>
                    <Animated.View style={[s.progressFill, { width: widthInterpolation }]}>
                        <View style={s.progressGlow} />
                    </Animated.View>
                </View>
                {eta && (
                    <View style={s.etaRow}>
                        <Clock size={12} color="#000" />
                        <Text style={s.etaText}>{eta}</Text>
                    </View>
                )}
            </View>
        );
    };

    // ── RENDER ──
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <View style={s.overlay}>
                <View style={s.sheet}>
                    <View style={s.handle} />

                    {/* Header */}
                    <View style={s.header}>
                        <View>
                            <Text style={s.title}>
                                {step === 'template' && 'Bulk Upload Products'}
                                {step === 'uploading' && 'Processing File'}
                                {step === 'preview' && 'Review Import'}
                                {step === 'importing' && 'Importing Products'}
                                {step === 'success' && 'Import Complete!'}
                            </Text>
                            <Text style={s.subtitle}>
                                {step === 'template' && 'Upload multiple products at once'}
                                {step === 'uploading' && `Reading ${fileName}...`}
                                {step === 'preview' && `${parsedData.length} products ready`}
                                {step === 'importing' && `${processedItems} of ${totalItems} imported`}
                                {step === 'success' && `${totalItems} products added to inventory`}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                            <X size={20} color="#000" strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={s.content}
                        showsVerticalScrollIndicator={false}
                    >

                        {/* ── STEP 1: Template & Upload ── */}
                        {step === 'template' && (
                            <View>
                                {/* Download Template Section */}
                                <View style={s.templateSection}>
                                    <View style={s.templateIconRow}>
                                        <View style={s.templateIconBox}>
                                            <FileSpreadsheet size={24} color="#000" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.templateTitle}>Download Template</Text>
                                            <Text style={s.templateDesc}>Excel template with correct format</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={s.downloadBtn} onPress={handleDownloadTemplate}>
                                        <Download size={18} color="#fff" strokeWidth={2.5} />
                                        <Text style={s.downloadBtnText}>DOWNLOAD TEMPLATE</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Format Guide — Compact cards */}
                                <View style={s.formatGuide}>
                                    <View style={s.formatGuideHeader}>
                                        <Info size={14} color="#000" />
                                        <Text style={s.tableSectionTitle}>COLUMN FORMAT</Text>
                                    </View>

                                    {/* Product Fields Card */}
                                    <View style={s.formatCard}>
                                        <View style={s.formatCardHeader}>
                                            <Package size={14} color="#000" />
                                            <Text style={s.formatCardTitle}>Product Fields</Text>
                                        </View>
                                        <View style={s.formatChips}>
                                            {TEMPLATE_COLUMNS.map((col, i) => (
                                                <View key={i} style={[s.formatChip, col.required && s.formatChipRequired]}>
                                                    <Text style={[s.formatChipText, col.required && s.formatChipTextRequired]}>
                                                        {col.label}{col.required ? ' *' : ''}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Variant Fields Card */}
                                    <View style={[s.formatCard, { borderColor: '#000' }]}>
                                        <View style={s.formatCardHeader}>
                                            <Layers size={14} color="#000" />
                                            <Text style={[s.formatCardTitle, { color: '#000' }]}>Variant Columns</Text>
                                            <View style={s.unlimitedBadge}>
                                                <Text style={s.unlimitedBadgeText}>UNLIMITED</Text>
                                            </View>
                                        </View>
                                        <Text style={s.formatCardDesc}>
                                            For each variant, add 3 columns:
                                        </Text>
                                        <View style={s.variantFormatRow}>
                                            <View style={s.variantFormatItem}>
                                                <Text style={s.variantFormatNum}>1</Text>
                                                <Text style={s.variantFormatLabel}>Variant N Detail</Text>
                                            </View>
                                            <View style={s.variantFormatItem}>
                                                <Text style={s.variantFormatNum}>2</Text>
                                                <Text style={s.variantFormatLabel}>Variant N Price (₹)</Text>
                                            </View>
                                            <View style={s.variantFormatItem}>
                                                <Text style={s.variantFormatNum}>3</Text>
                                                <Text style={s.variantFormatLabel}>Variant N Stock</Text>
                                            </View>
                                        </View>
                                        <Text style={s.variantExample}>
                                            Example: Variant 1 Detail = "Red", Variant 2 Detail = "Blue" ...
                                        </Text>
                                    </View>
                                </View>

                                {/* Quick Info */}
                                <View style={s.infoCard}>
                                    <AlertCircle size={16} color="#000" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.infoText}>
                                            <Text style={s.infoBold}>Required:</Text> Product Name, SKU, Selling Price
                                        </Text>
                                        <Text style={[s.infoText, { marginTop: 3 }]}>
                                            <Text style={s.infoBold}>Formats:</Text> .xlsx, .csv, .json
                                        </Text>
                                    </View>
                                </View>

                                {/* Upload Button */}
                                <TouchableOpacity style={s.uploadBtn} onPress={handleFilePick} activeOpacity={0.8}>
                                    <View style={s.uploadIconCircle}>
                                        <ArrowUpCircle size={24} color="#fff" />
                                    </View>
                                    <View>
                                        <Text style={s.uploadBtnTitle}>SELECT FILE TO UPLOAD</Text>
                                        <Text style={s.uploadBtnSub}>Choose .xlsx, .csv or .json file</Text>
                                    </View>
                                    <ChevronRight size={20} color="rgba(255,255,255,0.5)" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── STEP 2: Uploading/Processing ── */}
                        {step === 'uploading' && (
                            <View style={s.uploadingContainer}>
                                <Animated.View style={[s.uploadingIconBox, { transform: [{ scale: pulseAnim }] }]}>
                                    <Upload size={40} color="#000" />
                                </Animated.View>
                                <Text style={s.uploadingTitle}>Processing Your File</Text>
                                <Text style={s.uploadingDesc}>
                                    Reading and validating <Text style={{ fontWeight: '900' }}>{fileName}</Text>
                                </Text>
                                <ProgressBar
                                    progress={uploadProgress}
                                    label="Reading File"
                                    eta={uploadProgress < 100 ? 'Parsing data...' : 'Almost done!'}
                                />
                                <View style={s.statusPills}>
                                    <View style={[s.statusPill, uploadProgress > 20 && s.statusPillActive]}>
                                        <Text style={[s.statusPillText, uploadProgress > 20 && s.statusPillTextActive]}>Reading</Text>
                                    </View>
                                    <View style={[s.statusPill, uploadProgress > 50 && s.statusPillActive]}>
                                        <Text style={[s.statusPillText, uploadProgress > 50 && s.statusPillTextActive]}>Validating</Text>
                                    </View>
                                    <View style={[s.statusPill, uploadProgress > 80 && s.statusPillActive]}>
                                        <Text style={[s.statusPillText, uploadProgress > 80 && s.statusPillTextActive]}>Mapping</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* ── STEP 3: Preview ── */}
                        {step === 'preview' && (
                            <View>
                                {/* Summary Banner */}
                                <View style={s.summaryBanner}>
                                    <View style={s.summaryItem}>
                                        <Text style={s.summaryNumber}>{parsedData.length}</Text>
                                        <Text style={s.summaryLabel}>VALID</Text>
                                    </View>
                                    <View style={s.summaryDivider} />
                                    <View style={s.summaryItem}>
                                        <Text style={[s.summaryNumber, errors.length > 0 && { color: '#000' }]}>{errors.length}</Text>
                                        <Text style={s.summaryLabel}>ERRORS</Text>
                                    </View>
                                    <View style={s.summaryDivider} />
                                    <View style={s.summaryItem}>
                                        <Text style={s.summaryNumber}>{parsedData.length + errors.length}</Text>
                                        <Text style={s.summaryLabel}>TOTAL</Text>
                                    </View>
                                </View>

                                {/* Errors */}
                                {errors.length > 0 && (
                                    <View style={s.errorsCard}>
                                        <View style={s.errorsHeader}>
                                            <AlertCircle size={16} color="#000" />
                                            <Text style={s.errorsTitle}>{errors.length} rows skipped</Text>
                                        </View>
                                        {errors.slice(0, 5).map((err, i) => (
                                            <Text key={i} style={s.errorItem}>• {err}</Text>
                                        ))}
                                        {errors.length > 5 && (
                                            <Text style={s.errorMore}>...and {errors.length - 5} more errors</Text>
                                        )}
                                    </View>
                                )}

                                {/* ETA Estimate */}
                                <View style={s.etaEstimateCard}>
                                    <Zap size={16} color="#000" />
                                    <Text style={s.etaEstimateText}>
                                        Estimated import time: <Text style={{ fontWeight: '900' }}>
                                            {parsedData.length < 50 ? '~5 seconds' :
                                                parsedData.length < 200 ? '~15 seconds' :
                                                    parsedData.length < 500 ? '~30 seconds' :
                                                        `~${Math.ceil(parsedData.length / 20)} seconds`}
                                        </Text>
                                    </Text>
                                </View>

                                {/* Preview Cards */}
                                <Text style={s.previewSectionTitle}>PREVIEW ({Math.min(parsedData.length, 5)} of {parsedData.length})</Text>
                                {parsedData.slice(0, 5).map((item, index) => (
                                    <View key={index} style={s.previewCard}>
                                        <View style={s.previewRow}>
                                            <View style={s.previewIconBox}>
                                                <Package size={16} color="#000" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={s.previewName} numberOfLines={1}>{item.name}</Text>
                                                <View style={s.previewTags}>
                                                    <Text style={s.previewTag}>SKU: {item.sku}</Text>
                                                    {item.category ? <Text style={s.previewTag}>{item.category}</Text> : null}
                                                    {item.brand ? <Text style={s.previewTag}>{item.brand}</Text> : null}
                                                </View>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={s.previewPrice}>₹{parseFloat(item.price || 0).toLocaleString()}</Text>
                                                <Text style={s.previewStock}>{item.stock || 0} {item.unit || 'pcs'}</Text>
                                            </View>
                                        </View>
                                        {/* Variant pills */}
                                        {item.variants && item.variants.length > 0 && (
                                            <View style={s.previewVariantsRow}>
                                                <View style={s.previewVariantLabel}>
                                                    <Layers size={10} color="#000" />
                                                    <Text style={s.previewVariantLabelText}>{item.variants.length} VARIANTS</Text>
                                                </View>
                                                <View style={s.previewVariantPills}>
                                                    {item.variants.map((v, vi) => (
                                                        <View key={vi} style={s.previewVariantPill}>
                                                            <Text style={s.previewVariantPillText}>{v.name}</Text>
                                                            {v.price !== null && v.price !== undefined && (
                                                                <Text style={s.previewVariantPriceText}>₹{v.price}</Text>
                                                            )}
                                                            <Text style={s.previewVariantStockText}>×{v.stock || 0}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                ))}
                                {parsedData.length > 5 && (
                                    <Text style={s.moreItems}>...and {parsedData.length - 5} more products</Text>
                                )}
                            </View>
                        )}

                        {/* ── STEP 4: Importing ── */}
                        {step === 'importing' && (
                            <View style={s.importingContainer}>
                                <Animated.View style={[s.uploadingIconBox, { transform: [{ scale: pulseAnim }] }]}>
                                    <Package size={40} color="#000" />
                                </Animated.View>
                                <Text style={s.uploadingTitle}>Adding Products to Inventory</Text>
                                <Text style={s.uploadingDesc}>
                                    {processedItems} of {totalItems} products imported
                                </Text>

                                <ProgressBar
                                    progress={importProgress}
                                    label="Importing Products"
                                    eta={estimatedTime}
                                />

                                <View style={s.importStatsRow}>
                                    <View style={s.importStat}>
                                        <Text style={s.importStatNumber}>{processedItems}</Text>
                                        <Text style={s.importStatLabel}>DONE</Text>
                                    </View>
                                    <View style={s.importStat}>
                                        <Text style={s.importStatNumber}>{totalItems - processedItems}</Text>
                                        <Text style={s.importStatLabel}>REMAINING</Text>
                                    </View>
                                </View>

                                <Text style={s.importNote}>
                                    Please don't close the app while importing
                                </Text>
                            </View>
                        )}

                        {/* ── STEP 5: Success ── */}
                        {step === 'success' && (
                            <View style={s.successContainer}>
                                <View style={s.successIconBox}>
                                    <CheckCircle2 size={56} color="#000" />
                                </View>
                                <Text style={s.successTitle}>Import Successful!</Text>
                                <Text style={s.successDesc}>
                                    <Text style={{ fontWeight: '900', color: '#000' }}>{totalItems}</Text> products have been added to your inventory.
                                </Text>
                                <View style={s.successStats}>
                                    <View style={s.successStatItem}>
                                        <Text style={s.successStatNum}>{totalItems}</Text>
                                        <Text style={s.successStatLabel}>Products Added</Text>
                                    </View>
                                    <View style={s.successDivider} />
                                    <View style={s.successStatItem}>
                                        <Text style={s.successStatNum}>
                                            {startTime ? `${Math.ceil((Date.now() - startTime) / 1000)}s` : '—'}
                                        </Text>
                                        <Text style={s.successStatLabel}>Time Taken</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                    </ScrollView>

                    {/* ── Footer ── */}
                    <View style={s.footer}>
                        {step === 'template' && (
                            <TouchableOpacity style={s.ghostBtn} onPress={handleClose}>
                                <Text style={s.ghostBtnText}>CANCEL</Text>
                            </TouchableOpacity>
                        )}
                        {step === 'preview' && (
                            <>
                                <TouchableOpacity style={s.ghostBtn} onPress={() => setStep('template')}>
                                    <Text style={s.ghostBtnText}>BACK</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.primaryBtn, parsedData.length === 0 && { opacity: 0.5 }]}
                                    onPress={handleConfirmImport}
                                    disabled={parsedData.length === 0}
                                >
                                    <Upload size={18} color="#fff" strokeWidth={2.5} />
                                    <Text style={s.primaryBtnText}>IMPORT {parsedData.length} PRODUCTS</Text>
                                </TouchableOpacity>
                            </>
                        )}
                        {step === 'success' && (
                            <TouchableOpacity style={s.successBtn} onPress={handleClose}>
                                <Text style={s.successBtnText}>DONE</Text>
                            </TouchableOpacity>
                        )}
                        {(step === 'uploading' || step === 'importing') && (
                            <View style={s.footerLoading}>
                                <ActivityIndicator size="small" color="#10b981" />
                                <Text style={s.footerLoadingText}>
                                    {step === 'uploading' ? 'Processing file...' : `Importing ${processedItems}/${totalItems}...`}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        height: '92%',
        width: '100%',
    },
    handle: { width: 40, height: 5, backgroundColor: '#000', borderRadius: 5, alignSelf: 'center', marginTop: 12 },

    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 20, paddingBottom: 16, alignItems: 'flex-start' },
    title: { fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: '#646464', fontWeight: '600', marginTop: 2 },
    closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#e5e5e5' },

    content: { paddingHorizontal: 24, paddingBottom: 20 },

    // Template Section
    templateSection: {
        backgroundColor: '#f5f5f5',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#000',
    },
    templateIconRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
    templateIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#000' },
    templateTitle: { fontSize: 16, fontWeight: '900', color: '#000' },
    templateDesc: { fontSize: 12, color: '#474747', fontWeight: '600', marginTop: 2 },
    downloadBtn: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 48,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    downloadBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

    // Format Guide
    formatGuide: { marginBottom: 16 },
    formatGuideHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    tableSectionTitle: { fontSize: 10, fontWeight: '900', color: '#474747', letterSpacing: 1 },

    // Format Card
    formatCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#000',
    },
    formatCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    formatCardTitle: { fontSize: 14, fontWeight: '900', color: '#000' },
    formatCardDesc: { fontSize: 12, color: '#646464', fontWeight: '600', marginBottom: 10 },

    // Format Chips 
    formatChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    formatChip: {
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    formatChipRequired: { backgroundColor: '#000', borderColor: '#000' },
    formatChipText: { fontSize: 11, fontWeight: '700', color: '#000' },
    formatChipTextRequired: { color: '#fff', fontWeight: '800' },

    // Variant format
    variantFormatRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    variantFormatItem: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#000',
    },
    variantFormatNum: { fontSize: 14, fontWeight: '900', color: '#000', marginBottom: 3 },
    variantFormatLabel: { fontSize: 9, fontWeight: '700', color: '#000', textAlign: 'center' },
    variantExample: { fontSize: 11, color: '#646464', fontWeight: '600', fontStyle: 'italic' },

    // Unlimited badge
    unlimitedBadge: {
        backgroundColor: '#000',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginLeft: 'auto',
    },
    unlimitedBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

    // Info Card
    infoCard: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#000',
    },
    infoText: { fontSize: 12, color: '#000', lineHeight: 18 },
    infoBold: { fontWeight: '900' },

    // Upload Button
    uploadBtn: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 6,
    },
    uploadIconCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    uploadBtnTitle: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
    uploadBtnSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },

    // Uploading Container
    uploadingContainer: { alignItems: 'center', paddingVertical: 30 },
    uploadingIconBox: {
        width: 90,
        height: 90,
        borderRadius: 28,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 2,
        borderColor: '#000',
    },
    uploadingTitle: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 6 },
    uploadingDesc: { fontSize: 14, color: '#646464', fontWeight: '600', textAlign: 'center', marginBottom: 30 },

    // Progress
    progressContainer: { width: '100%', marginBottom: 20 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
    progressPercent: { fontSize: 13, fontWeight: '900', color: '#000' },
    progressTrack: { height: 10, backgroundColor: '#f0f0f0', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e5e5' },
    progressFill: {
        height: '100%',
        backgroundColor: '#000',
        borderRadius: 6,
        position: 'relative',
    },
    progressGlow: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 20,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 6,
    },
    etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    etaText: { fontSize: 12, color: '#646464', fontWeight: '600' },

    // Status Pills
    statusPills: { flexDirection: 'row', gap: 10, marginTop: 10 },
    statusPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e5e5' },
    statusPillActive: { backgroundColor: '#000', borderColor: '#000' },
    statusPillText: { fontSize: 11, fontWeight: '800', color: '#646464' },
    statusPillTextActive: { color: '#fff' },

    // Summary Banner
    summaryBanner: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: '#000',
        justifyContent: 'space-around',
    },
    summaryItem: { alignItems: 'center' },
    summaryNumber: { fontSize: 28, fontWeight: '900', color: '#000' },
    summaryLabel: { fontSize: 9, fontWeight: '900', color: '#646464', letterSpacing: 1, marginTop: 2 },
    summaryDivider: { width: 1.5, backgroundColor: '#e5e5e5' },

    // Errors
    errorsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#000' },
    errorsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    errorsTitle: { fontSize: 13, fontWeight: '800', color: '#000' },
    errorItem: { fontSize: 12, color: '#474747', marginBottom: 4, fontWeight: '600' },
    errorMore: { fontSize: 11, color: '#000', fontStyle: 'italic', marginTop: 4 },

    // ETA Estimate
    etaEstimateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#f5f5f5',
        padding: 14,
        borderRadius: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#000',
    },
    etaEstimateText: { fontSize: 13, color: '#000', fontWeight: '600' },

    // Preview
    previewSectionTitle: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1, marginBottom: 12 },
    previewCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: '#e5e5e5',
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    previewIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
    previewName: { fontSize: 14, fontWeight: '800', color: '#000' },
    previewTags: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    previewTag: { fontSize: 10, color: '#fff', backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '700' },
    previewPrice: { fontSize: 16, fontWeight: '900', color: '#000' },
    previewStock: { fontSize: 11, color: '#474747', fontWeight: '700', marginTop: 2 },
    moreItems: { textAlign: 'center', color: '#646464', fontSize: 13, fontWeight: '600', fontStyle: 'italic', marginTop: 8 },

    // Importing Container
    importingContainer: { alignItems: 'center', paddingVertical: 30 },
    importStatsRow: { flexDirection: 'row', gap: 30, marginTop: 10 },
    importStat: { alignItems: 'center' },
    importStatNumber: { fontSize: 24, fontWeight: '900', color: '#000' },
    importStatLabel: { fontSize: 9, fontWeight: '900', color: '#646464', letterSpacing: 1, marginTop: 2 },
    importNote: { fontSize: 12, color: '#646464', fontWeight: '600', fontStyle: 'italic', marginTop: 20, textAlign: 'center' },

    // Success
    successContainer: { alignItems: 'center', paddingVertical: 30 },
    successIconBox: {
        width: 100,
        height: 100,
        borderRadius: 30,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#000',
    },
    successTitle: { fontSize: 24, fontWeight: '900', color: '#000', marginBottom: 8 },
    successDesc: { fontSize: 15, color: '#646464', fontWeight: '600', textAlign: 'center', lineHeight: 22 },
    successStats: {
        flexDirection: 'row',
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        padding: 24,
        marginTop: 24,
        width: '100%',
        justifyContent: 'space-around',
        borderWidth: 1.5,
        borderColor: '#000',
    },
    successStatItem: { alignItems: 'center' },
    successStatNum: { fontSize: 22, fontWeight: '900', color: '#000' },
    successStatLabel: { fontSize: 10, fontWeight: '800', color: '#646464', marginTop: 4 },
    successDivider: { width: 1.5, backgroundColor: '#000' },

    // Footer
    footer: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        borderTopWidth: 1.5,
        borderColor: '#e5e5e5',
        gap: 12,
        backgroundColor: '#fff',
    },
    ghostBtn: {
        flex: 1,
        height: 54,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#000',
        backgroundColor: '#fff',
    },
    ghostBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
    primaryBtn: {
        flex: 2,
        height: 54,
        backgroundColor: '#000',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
    successBtn: {
        flex: 1,
        height: 54,
        backgroundColor: '#000',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    footerLoading: {
        flex: 1,
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e5e5',
    },
    footerLoadingText: { fontSize: 13, fontWeight: '700', color: '#000' },

    // Variant hint text
    variantHint: {
        fontSize: 11,
        color: '#474747',
        fontWeight: '600',
        marginBottom: 10,
        lineHeight: 16,
    },

    // Preview variant styles
    previewVariantsRow: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e5e5e5',
    },
    previewVariantLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 8,
    },
    previewVariantLabelText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 1,
    },
    previewVariantPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    previewVariantPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: 1.5,
        borderColor: '#000',
        gap: 6,
    },
    previewVariantPillText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#000',
    },
    previewVariantPriceText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
    },
    previewVariantStockText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#646464',
    },
});

export default BulkUploadModal;
