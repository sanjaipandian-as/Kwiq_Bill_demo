import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, Keyboard, Platform, KeyboardAvoidingView } from 'react-native';
import { Trash2, Plus, Minus, Percent, Search, Upload, Scan, Package, Tag, Award, MessageSquare, ChevronUp, ChevronDown, X, Barcode, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useProducts } from '../../../context/ProductContext';
import BottomFunctionBar from './BottomFunctionBar';



// Helper Component for Safe Number Input
const NumberInput = ({ value, onChange, min = 0, style = {}, prefix = null }) => {
    const [localVal, setLocalVal] = useState(String(value));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalVal(String(value));
        }
    }, [value, isFocused]);

    const handleCommit = () => {
        const num = parseFloat(localVal);
        if (!isNaN(num) && isFinite(num) && num >= min && num <= 999999) {
            onChange(num);
        } else {
            setLocalVal(String(value));
        }
    };

    return (
        <View style={[
            styles.inputWrapper,
            isFocused && styles.inputWrapperFocused,
            style
        ]}>
            {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
            <TextInput
                style={styles.ghostInput}
                value={localVal}
                keyboardType="decimal-pad"
                selectTextOnFocus
                onChangeText={setLocalVal}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    setIsFocused(false);
                    handleCommit();
                }}
                onSubmitEditing={() => {
                    handleCommit();
                    Keyboard.dismiss();
                }}
                returnKeyType="done"
            />
        </View>
    );
};

const BillingGrid = ({
    products,
    cart,
    updateQuantity,
    updatePrice,
    removeItem,
    selectedItemId,
    onRowClick,
    onDiscountClick,
    onAddQuickItem,
    onScanClick,
    additionalCharges = 0,
    loyaltyDiscount = 0,
    remarks = '',
    onChargesClick,
    onLoyaltyClick,
    onRemarksClick,
    onFunctionClick,
    billDiscount = 0,
    onRemoveAdjustment,
    onRemoveItemDiscount
}) => {
    const [barcodeModal, setBarcodeModal] = useState({ isOpen: false, barcode: '', name: '' });
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = async (text) => {
        await Clipboard.setStringAsync(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Optimization: Create a map of product ID to quantity to avoid O(N) lookup inside O(M) list rendering
    const cartQtyMap = useMemo(() => {
        const map = {};
        (cart || []).forEach(item => {
            const dbId = item._dbId || item.id;
            if (dbId) {
                map[dbId] = (map[dbId] || 0) + (item.quantity || 0);
            }
        });
        return map;
    }, [cart]);

    const suggestedItems = useMemo(() => products || [], [products]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchInputRef = React.useRef(null);
    const listRef = React.useRef(null);



    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
            setKeyboardVisible(true);
        });
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardVisible(false);
        });
        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    const closeSearch = () => {
        setSearchQuery('');
        setIsSearchFocused(false);
        Keyboard.dismiss();
        if (searchInputRef.current) searchInputRef.current.blur();
    };

    const scrollToTop = () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const filteredSuggestions = useMemo(() => {
        return suggestedItems
            .filter(item => {
                const sl = searchQuery.toLowerCase();
                const matchesSearch = item.name.toLowerCase().includes(sl) ||
                    (item.sku && item.sku.toLowerCase().includes(sl));
                return matchesSearch;
            })
            .sort((a, b) => {
                let comparison = 0;
                if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
                else if (sortBy === 'price') comparison = (a.price || 0) - (b.price || 0);
                return sortOrder === 'asc' ? comparison : -comparison;
            });
    }, [suggestedItems, searchQuery, sortBy, sortOrder]);

    const renderItem = useCallback(({ item }) => {
        const isSelected = item.id === selectedItemId;

        return (
            <TouchableOpacity
                style={[styles.cartCard, isSelected && styles.selectedCartCard]}
                onPress={() => onRowClick(item.id)}
                activeOpacity={0.8}
            >
                <View style={styles.cardMain}>
                    <View style={styles.cardInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.priceRow}>
                            <NumberInput
                                value={item.price}
                                onChange={(val) => updatePrice(item.id, val)}
                                prefix="₹"
                                style={{ width: 85, height: 32 }}
                            />
                            <Text style={styles.priceDivider}> • </Text>
                            <View style={styles.taxBadgeContainer}>
                                <Text style={styles.taxBadge}>GST {item.taxRate}%</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.cardRight}>
                        <View style={styles.qtyContainer}>
                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); updateQuantity(item.id, Math.max(0.01, (item.quantity || 1) - 1)); }}
                                style={styles.qtyAction}
                            >
                                <Minus size={14} color="#000" />
                            </TouchableOpacity>

                            <NumberInput
                                value={item.quantity}
                                onChange={(val) => updateQuantity(item.id, val)}
                                min={0.01}
                                style={styles.qtyInput}
                            />

                            <TouchableOpacity
                                onPress={(e) => { e.stopPropagation(); updateQuantity(item.id, (item.quantity || 1) + 1); }}
                                style={styles.qtyAction}
                            >
                                <Plus size={14} color="#000" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.totalWrapper}>
                            <Text style={styles.totalLabel}>Amount:</Text>
                            <Text style={styles.itemTotal}>₹{(item.total || 0).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {item.discount > 0 && (
                    <View style={styles.discountBadge}>
                        <Text style={styles.discountBadgeText}>-₹{item.discount.toFixed(2)} OFF</Text>
                    </View>
                )}

                {isSelected && (
                    <View style={styles.cardActions}>
                        {item.discount > 0 ? (
                            <TouchableOpacity onPress={() => onRemoveItemDiscount(item.id)} style={[styles.actionPill, { backgroundColor: '#fee2e2' }]}>
                                <X size={14} color="#ef4444" />
                                <Text style={[styles.actionPillText, { color: '#ef4444' }]}>Remove Disc.</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => onDiscountClick(item.id)} style={styles.actionPill}>
                                <Percent size={14} color="#000" />
                                <Text style={styles.actionPillText}>Discount</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            onPress={() => setBarcodeModal({ isOpen: true, barcode: item.sku || item.barcode || item.id?.toString(), name: item.name })}
                            style={[styles.barcodeTag, { marginTop: 0, marginLeft: 'auto', marginRight: 8, maxWidth: 120 }]}
                        >
                            <Barcode size={12} color="#64748b" />
                            <Text 
                                style={[styles.barcodeTagText, { fontSize: 10 }]} 
                                numberOfLines={1} 
                                ellipsizeMode="tail"
                            >
                                {item.sku || item.barcode || item.id?.toString().slice(-6)}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => removeItem(item.id)} style={[styles.actionPill, { backgroundColor: '#fee2e2' }]}>
                            <Trash2 size={14} color="#ef4444" />
                            <View style={{ width: 4 }} />
                            <Text style={[styles.actionPillText, { color: '#ef4444' }]}>Remove</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    }, [selectedItemId, onRowClick, updatePrice, updateQuantity, onRemoveItemDiscount, onDiscountClick, removeItem, barcodeModal, cartQtyMap]);

    const renderSuggestionItem = useCallback(({ item }) => {
        const cartQty = cartQtyMap[item.id] || 0;
        const hasNoStock = (item.stock || 0) <= 0;

        return (
            <TouchableOpacity
                style={[
                    styles.suggestionItem,
                    cartQty > 0 && styles.suggestionItemInCart
                ]}
                onPress={() => {
                    onAddQuickItem && onAddQuickItem(item);
                    if (searchQuery !== '') {
                        setSearchQuery('');
                    }
                    if (!isKeyboardVisible) {
                        setIsSearchFocused(false);
                    }
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <Text style={[styles.suggestedName, { flex: 1, marginRight: 4 }]} numberOfLines={2}>{item.name}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: hasNoStock ? '#94a3b8' : '#000' }}>
                            Qty: {item.stock || 0}
                        </Text>
                    </View>
                </View>

                <View style={styles.suggestedFooter}>
                    <View>
                        <Text style={styles.suggestedPrice}>₹{item.price}</Text>
                        {cartQty > 0 && (
                            <View style={styles.inCartPill}>
                                <Text style={styles.inCartPillText}>{cartQty} ADDED</Text>
                            </View>
                        )}
                    </View>
                    <View style={[styles.addBtnSmall, hasNoStock && { backgroundColor: '#e2e8f0' }]}>
                        <Plus size={14} color={hasNoStock ? "#94a3b8" : "#fff"} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [cartQtyMap, onAddQuickItem, searchQuery, isKeyboardVisible]);

    return (
        <View style={styles.container}>
            {!isSearchFocused && (
                <View style={styles.cartSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>ITEMS ({cart.length})</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                            style={styles.adjRow}
                        >
                            {Number(billDiscount) > 0 && (
                                <View style={[styles.adjPill, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                                    <Tag size={10} color="#000" />
                                    <Text style={[styles.adjPillText, { fontSize: 10, color: '#000' }]}>Disc: ₹{Number(billDiscount)}</Text>
                                    <TouchableOpacity onPress={() => onRemoveAdjustment('discount')}>
                                        <X size={10} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            {Number(loyaltyDiscount) > 0 && (
                                <View style={[styles.adjPill, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#000', borderColor: '#000' }]}>
                                    <Award size={10} color="#fff" />
                                    <Text style={[styles.adjPillText, { fontSize: 10, color: '#fff' }]}>Loyalty: ₹{Number(loyaltyDiscount)}</Text>
                                    <TouchableOpacity onPress={() => onRemoveAdjustment('loyalty')}>
                                        <X size={10} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            {Number(additionalCharges) > 0 && (
                                <View style={[styles.adjPill, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
                                    <Plus size={10} color="#000" />
                                    <Text style={[styles.adjPillText, { fontSize: 10, color: '#000' }]}>Extra: ₹{Number(additionalCharges)}</Text>
                                    <TouchableOpacity onPress={() => onRemoveAdjustment('charges')}>
                                        <X size={10} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            {remarks && remarks.trim() !== '' && (
                                <View style={[styles.adjPill, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                                    <MessageSquare size={10} color="#64748b" />
                                    <Text style={[styles.adjPillText, { color: '#64748b', fontSize: 10, maxWidth: 100 }]} numberOfLines={1}>{remarks}</Text>
                                    <TouchableOpacity onPress={() => onRemoveAdjustment('remarks')}>
                                        <X size={10} color="#94a3b8" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    <FlatList
                        data={cart}
                        keyExtractor={(item, index) => {
                            const stableId = item.id || item._dbId || item.sku;
                            return stableId ? String(stableId) : `cart-item-${index}`;
                        }}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        initialNumToRender={5}
                        maxToRenderPerBatch={10}
                        removeClippedSubviews={Platform.OS === 'android'}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIconBox}>
                                    <Search size={32} color="#94a3b8" />
                                </View>
                                <Text style={styles.emptyText}>Empty Cart</Text>
                                <Text style={styles.emptySubText}>Add items from suggestions below</Text>
                            </View>
                        }
                    />
                </View>
            )}

            <View
                style={[
                    styles.suggestionSection,
                    (isKeyboardVisible || isSearchFocused)
                        ? { flex: 1, paddingTop: 10 }
                        : (cart.length > 0 ? { flex: 0, height: '50%', minHeight: 330 } : { flex: 1 })
                ]}
            >
                {cart.length > 0 && !isSearchFocused && !isKeyboardVisible && (
                    <BottomFunctionBar onFunctionClick={onFunctionClick} variant="inline" />
                )}
                <View style={styles.searchBarContainer}>
                    <View style={styles.searchBox}>
                        <Search size={20} color="#94a3b8" />
                        <TextInput
                            ref={searchInputRef}
                            style={styles.searchInput}
                            placeholder="Find products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#94a3b8"
                            onFocus={() => {
                                setIsSearchFocused(true);
                            }}
                            onBlur={() => {
                                setTimeout(() => {
                                    if (searchQuery === '') {
                                        setIsSearchFocused(false);
                                    }
                                }, 100);
                            }}
                        />
                        {isSearchFocused && (
                            <TouchableOpacity onPress={closeSearch} style={styles.closeSearchBtn}>
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity style={styles.scanIconBox} onPress={onScanClick}>
                        <Scan size={20} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.filterTrigger} onPress={() => {
                        setSortBy(sortBy === 'name' ? 'price' : 'name');
                    }}>
                        <Text style={styles.filterText}>{sortBy === 'name' ? 'A-Z' : '₹'}</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={listRef}
                    data={filteredSuggestions}
                    keyExtractor={(item) => String(item._dbId || item.id || Math.random())}
                    numColumns={2}
                    columnWrapperStyle={{ gap: 4 }}
                    contentContainerStyle={[
                        { paddingBottom: isKeyboardVisible ? 60 : 80, paddingTop: 8 }
                    ]}
                    initialNumToRender={12}
                    windowSize={5}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={Platform.OS === 'android'}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    renderItem={renderSuggestionItem}
                    ListFooterComponent={
                        filteredSuggestions.length > 0 ? (
                            <TouchableOpacity onPress={scrollToTop} style={styles.footerToTop}>
                                <Text style={styles.footerToTopText}>Go to top</Text>
                            </TouchableOpacity>
                        ) : null
                    }
                />
            </View>

            <BarcodeViewModal 
                isOpen={barcodeModal.isOpen}
                onClose={() => setBarcodeModal({ ...barcodeModal, isOpen: false })}
                barcode={barcodeModal.barcode}
                name={barcodeModal.name}
                onCopy={copyToClipboard}
                isCopied={isCopied}
            />
        </View>
    );
};

const BarcodeViewModal = ({ isOpen, onClose, barcode, name, onCopy, isCopied }) => {
    if (!isOpen) return null;

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
            <TouchableOpacity 
                activeOpacity={1} 
                onPress={onClose}
                style={styles.modalOverlay}
            >
                <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 360 }}>
                    <View style={styles.barcodeModalContent}>
                        <View style={styles.modalHeaderRow}>
                            <View style={styles.modalIconBox}>
                                <Barcode size={24} color="#000" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitleSmall}>PRODUCT BARCODE</Text>
                                <Text style={styles.modalProductName} numberOfLines={1}>{name}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtnSmall}>
                                <X size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.barcodeDisplayBox}>
                            <Text style={styles.barcodeStringText}>{barcode}</Text>
                            <TouchableOpacity 
                                style={[styles.copyBtnLarge, isCopied && styles.copyBtnSuccess]} 
                                onPress={() => onCopy(barcode)}
                            >
                                {isCopied ? <Check size={20} color="#fff" /> : <Copy size={20} color="#000" />}
                                <Text style={[styles.copyBtnText, isCopied && { color: '#fff' }]}>
                                    {isCopied ? 'COPIED!' : 'COPY CODE'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.modalDoneBtn} onPress={onClose}>
                            <Text style={styles.modalDoneBtnText}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
};

export default BillingGrid;
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },

    // Cart Section
    cartSection: { flex: 1, marginBottom: 2 },
    sectionHeader: { alignItems: 'center', marginBottom: 4 },
    sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 2, textAlign: 'center' },
    adjRow: { marginTop: 4, width: '100%' },

    // Cart Card
    cartCard: {
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    selectedCartCard: { borderColor: '#000', backgroundColor: '#f8fafc' },
    cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardInfo: { flex: 1 },
    itemSku: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 0 },
    itemName: { fontSize: 15, fontWeight: '800', color: '#000' },
    priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
    itemUnitPrice: { fontSize: 12, color: '#475569', fontWeight: '700' },
    taxBadge: { fontSize: 9, fontWeight: '900', color: '#000', backgroundColor: '#f1f5f9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, borderWidth: 1, borderColor: '#e2e8f0' },

    cardRight: { minWidth: 90, alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 1 },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#f8fafc', padding: 2, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    qtyAction: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1, borderWidth: 1, borderColor: '#f1f5f9' },
    totalWrapper: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 6
    },
    totalLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
    itemTotal: { fontSize: 20, fontWeight: '900', color: '#000', letterSpacing: -0.5 },
    barcodeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' },
    barcodeTagText: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 0.4 },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        paddingHorizontal: 10,
        overflow: 'hidden'
    },
    inputWrapperFocused: {
        borderColor: '#000',
    },
    inputPrefix: {
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        marginRight: 4
    },
    ghostInput: {
        flex: 1,
        fontSize: 14,
        fontWeight: '900',
        color: '#000',
        paddingVertical: 4,
        textAlign: 'center',
        height: '100%'
    },
    qtyInput: {
        width: 45,
        height: 30,
        paddingHorizontal: 0,
        borderWidth: 0,
        backgroundColor: 'transparent'
    },
    priceDivider: { fontSize: 13, color: '#cbd5e1', fontWeight: '500', marginHorizontal: 4 },
    taxBadgeContainer: { justifyContent: 'center' },

    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9'
    },
    actionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10
    },
    actionPillText: { fontSize: 11, fontWeight: '800', color: '#000' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
    emptyIconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    emptyText: { fontSize: 14, fontWeight: '800', color: '#94a3b8' },
    emptySubText: { fontSize: 10, color: '#cbd5e1', marginTop: 2 },

    // Suggestions Section
    suggestionSection: {
        flex: 1,
        backgroundColor: '#fff',
        marginHorizontal: -20,
        paddingHorizontal: 20,
        borderTopLeftRadius: 35,
        borderTopRightRadius: 35,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 15
    },
    searchBarContainer: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#f1f5f9' },
    searchInput: { flex: 1, fontSize: 13, color: '#000', fontWeight: '600', marginLeft: 8 },
    closeSearchBtn: { padding: 4 },
    filterTrigger: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
    filterText: { color: '#fff', fontWeight: '900', fontSize: 11 },
    scanIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

    suggestionItem: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 10, borderWidth: 1.5, borderColor: '#f1f5f9', marginBottom: 4, minHeight: 90, justifyContent: 'space-between' },
    suggestionItemInCart: { borderColor: '#000', backgroundColor: '#f8fafc', borderWidth: 2 },
    suggestedName: { fontSize: 13, fontWeight: '900', color: '#000', marginBottom: 2 },
    suggestedFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    suggestedPrice: { fontSize: 15, fontWeight: '900', color: '#000' },
    addBtnSmall: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    discountBadgeText: { fontSize: 9, fontWeight: '900', color: '#000' },
    discountBadge: { position: 'absolute', top: -10, right: 10, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1.5, borderColor: '#000' },
    inCartPill: { backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2, alignSelf: 'flex-start' },
    inCartPillText: { fontSize: 8, color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.3 },

    adjPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    adjPillText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#475569',
    },
    // Barcode Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        padding: 24,
    },
    barcodeModalContent: {
        backgroundColor: '#fff',
        borderRadius: 28,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitleSmall: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94a3b8',
        letterSpacing: 1.5,
    },
    modalProductName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#000',
    },
    modalCloseBtnSmall: {
        padding: 8,
    },
    barcodeDisplayBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 24,
    },
    barcodeStringText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#000',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: 0.5,
    },
    copyBtnLarge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 14,
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#000',
    },
    copyBtnSuccess: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    copyBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#000',
        letterSpacing: 0.5,
    },
    modalDoneBtn: {
        backgroundColor: '#000',
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalDoneBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
    footerToTop: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 0
    },
    footerToTopText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#000',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textDecorationLine: 'underline'
    }
});
