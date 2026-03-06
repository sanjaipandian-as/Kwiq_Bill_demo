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
        marginBottom: 4,
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: 8,
        paddingBottom: 6
    },
    chip: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    chipActive: {
        backgroundColor: '#fff',
        borderColor: '#fff',
    },
    chipText: {
        fontSize: 14,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
    },
    chipTextActive: {
        color: '#000',
        fontWeight: '800'
    }
});
