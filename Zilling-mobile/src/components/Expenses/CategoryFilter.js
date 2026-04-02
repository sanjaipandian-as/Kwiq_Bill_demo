import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';

export const CategoryFilter = ({ categories = [], selectedCategory, onCategoryChange }) => {
    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <TouchableOpacity
                    style={[styles.chip, !selectedCategory && styles.chipActive]}
                    onPress={() => onCategoryChange(null)}
                >
                    <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All Items</Text>
                </TouchableOpacity>
                {categories.map((cat, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                        onPress={() => onCategoryChange(cat)}
                    >
                        <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: 10,
        paddingBottom: 4
    },
    chip: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#f1f5f9',
    },
    chipActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: '900'
    }
});
