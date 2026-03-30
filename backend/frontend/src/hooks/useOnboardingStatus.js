/**
 * Hook to determine if user has completed onboarding profile setup
 */
export const useOnboardingStatus = (settings) => {
    const isComplete = isProfileComplete(settings);
    return {
        isComplete,
        needsOnboarding: !isComplete
    };
};

/**
 * Check if profile setup is complete based on required fields
 * @param {Object} settings - Settings object from SettingsContext
 * @returns {boolean} - True if all required fields are filled
 */
export const isProfileComplete = (settings) => {
    if (!settings) return false;

    // Required store fields
    const hasStoreName = Boolean(settings?.store?.name?.trim());
    const hasStoreContact = Boolean(settings?.store?.contact?.trim());
    const hasStoreCity = Boolean(settings?.store?.address?.city?.trim());

    // Required user fields (new structure)
    const hasUserFullName = Boolean(settings?.user?.fullName?.trim());
    const hasUserMobile = Boolean(settings?.user?.mobile?.trim());

    // All required fields must be present
    return hasStoreName && hasStoreContact && hasStoreCity && hasUserFullName && hasUserMobile;
};
