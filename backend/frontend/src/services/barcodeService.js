import axios from 'axios';

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v0/product/';

/**
 * Fetches product metadata given a barcode.
 * @param {string} barcode 
 * @returns {Promise<Object|null>} Product data or null if not found
 */
export const fetchProductMetadata = async (barcode) => {
    if (!barcode) return null;

    try {
        const response = await axios.get(`${OPEN_FOOD_FACTS_API}${barcode}.json`);

        if (response.data && response.data.status === 1) {
            const product = response.data.product;

            // Extract relevant fields
            // Accessing categories - they come as a comma separated string often
            let category = 'Uncategorized';
            if (product.categories) {
                // Take the first category that looks reasonably short, or just the first part
                const cats = product.categories.split(',').map(c => c.trim());
                if (cats.length > 0) category = cats[0];
            }

            return {
                name: product.product_name || product.product_name_en || '',
                brand: product.brands || '',
                category: category,
                image: product.image_url || '',
                // OpenFoodFacts doesn't track price/stock effectively, so we leave those
            };
        }
        return null;
    } catch (error) {
        console.error("Error fetching barcode metadata:", error);
        return null; // Fail gracefully
    }
};

export default {
    fetchProductMetadata
};
