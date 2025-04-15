const axios = require('axios');

/**
 * Lookup a phone number using multiple API services
 * @param {string} phoneNumber - Phone number to lookup (with country code)
 * @returns {Promise<Object>} - Contact information
 */
async function lookupPhoneNumber(phoneNumber) {
    try {
        console.log(`Looking up phone number ${phoneNumber}...`);
        
        // Normalize the phone number - remove all non-numeric characters except leading +
        let cleanNumber;
        if (phoneNumber.startsWith('+')) {
            cleanNumber = '+' + phoneNumber.substring(1).replace(/\D/g, '');
        } else {
            cleanNumber = phoneNumber.replace(/\D/g, '');
            // If the number doesn't have a country code (starts with +), try to add one
            // Assume +91 (India) for 10-digit numbers without country code
            if (cleanNumber.length === 10 && !cleanNumber.startsWith('+')) {
                cleanNumber = '+91' + cleanNumber;
            }
        }
        
        console.log(`Normalized number: ${cleanNumber}`);
        
        // Try multiple services in sequence for better results
        const info = await tryMultipleServices(cleanNumber);
        
        // Ensure we have the correct number in the result
        info.number = phoneNumber; // Use original input for display
        
        return info;
    } catch (error) {
        console.error('Phone lookup error:', error.message);
        
        // Return basic information even on error
        const countryInfo = identifyCountryFromNumber(phoneNumber.replace(/\D/g, ''));
        return {
            number: phoneNumber,
            name: 'Unknown',
            carrier: 'Unknown',
            lineType: 'mobile',
            location: countryInfo ? countryInfo.name : 'Unknown',
            countryCode: countryInfo ? countryInfo.code : 'Unknown',
            countryName: countryInfo ? countryInfo.name : 'Unknown',
            email: '',
            isValid: countryInfo ? true : false
        };
    }
}

/**
 * Try multiple phone lookup services with fallbacks
 * @param {string} phoneNumber - Clean phone number to lookup
 * @returns {Promise<Object>} - Phone information
 */
async function tryMultipleServices(phoneNumber) {
    // Result object to store all gathered information
    const result = {
        number: phoneNumber,
        name: 'Unknown',
        carrier: 'Unknown',
        lineType: 'Unknown',
        location: 'Unknown',
        countryCode: 'Unknown',
        countryName: 'Unknown',
        email: '',
        isValid: false
    };
    
    // Identify country from number first as fallback
    try {
        // Basic country code identification from first few digits
        const countryCodeInfo = identifyCountryFromNumber(phoneNumber);
        if (countryCodeInfo) {
            result.countryCode = countryCodeInfo.code;
            result.countryName = countryCodeInfo.name;
            result.isValid = true;
        }
    } catch (error) {
        console.log('Country identification error:', error.message);
    }
    
    // Try NumVerify API (number validation)
    try {
        if (!process.env.APILAYER_KEY) {
            console.log('NumVerify API key not set in .env file');
            throw new Error('API key not configured');
        }
        
        const response = await axios.get(`https://api.apilayer.com/number_verification/validate?number=${phoneNumber}`, {
            headers: {
                'apikey': process.env.APILAYER_KEY
            },
            timeout: 5000
        });
        
        if (response.data) {
            result.isValid = response.data.valid || false;
            result.carrier = response.data.carrier || result.carrier;
            result.lineType = response.data.line_type || result.lineType;
            result.countryCode = response.data.country_code || result.countryCode;
            result.countryName = response.data.country_name || result.countryName;
            result.location = response.data.location || result.location;
        }
    } catch (error) {
        console.log('NumVerify API error:', error.message);
    }
    
    // Try NumLookupAPI
    try {
        if (!process.env.NUMLOOKUP_API_KEY) {
            console.log('NumLookupAPI key not set in .env file');
            throw new Error('API key not configured');
        }
        
        const response = await axios.get(`https://numlookupapi.com/api/v1/phone/${phoneNumber}`, {
            params: {
                apikey: process.env.NUMLOOKUP_API_KEY
            },
            timeout: 5000
        });
        
        if (response.data) {
            result.isValid = response.data.valid || result.isValid;
            result.carrier = response.data.carrier || result.carrier;
            result.lineType = response.data.line_type || result.lineType;
            result.countryCode = response.data.country_code || result.countryCode;
            result.countryName = response.data.country_name || result.countryName;
            result.location = response.data.location || result.location;
        }
    } catch (error) {
        console.log('NumLookupAPI error:', error.message);
    }
    
    // Try AbstractAPI as another alternative
    try {
        if (!process.env.ABSTRACT_API_KEY) {
            console.log('AbstractAPI key not set in .env file');
            throw new Error('API key not configured');
        }
        
        const response = await axios.get(`https://phonevalidation.abstractapi.com/v1/`, {
            params: {
                api_key: process.env.ABSTRACT_API_KEY,
                phone: phoneNumber
            },
            timeout: 5000
        });
        
        if (response.data) {
            result.isValid = response.data.valid || result.isValid;
            
            if (response.data.carrier) {
                result.carrier = response.data.carrier || result.carrier;
            }
            
            if (response.data.country) {
                result.countryCode = response.data.country.code || result.countryCode;
                result.countryName = response.data.country.name || result.countryName;
            }
            
            if (response.data.type) {
                result.lineType = response.data.type || result.lineType;
            }
            
            if (response.data.location) {
                result.location = response.data.location || result.location;
            }
        }
    } catch (error) {
        console.log('AbstractAPI error:', error.message);
    }
    
    // Try to infer carrier based on country codes (fallback for Indian numbers)
    if (result.countryCode === 'IN' && result.carrier === 'Unknown' && phoneNumber.length >= 10) {
        const prefix = phoneNumber.slice(-10).substring(0, 4);
        
        // Common Indian carrier prefixes
        const indianCarriers = {
            '9321': 'Reliance Jio',
            '9322': 'Reliance Jio',
            '9323': 'Reliance Jio',
            '9324': 'Reliance Jio',
            '9820': 'Vodafone',
            '9821': 'Vodafone',
            '9833': 'Airtel',
            '9871': 'Airtel',
            '9999': 'Airtel',
            '9930': 'BSNL',
            '9419': 'BSNL'
        };
        
        if (indianCarriers[prefix]) {
            result.carrier = indianCarriers[prefix];
        } else if (phoneNumber.slice(-10).startsWith('93')) {
            result.carrier = 'Reliance Jio';
        } else if (phoneNumber.slice(-10).startsWith('98')) {
            result.carrier = 'Vodafone Idea';
        } else if (phoneNumber.slice(-10).startsWith('99')) {
            result.carrier = 'Airtel';
        }
        
        // Set line type for Indian numbers
        if (result.lineType === 'Unknown') {
            result.lineType = 'mobile';
        }
        
        // Set location to India if unknown
        if (result.location === 'Unknown') {
            result.location = 'India';
        }
    }
    
    return result;
}

/**
 * Basic function to identify country from phone number's country code
 * @param {string} phoneNumber - Phone number
 * @returns {Object|null} - Country code info or null
 */
function identifyCountryFromNumber(phoneNumber) {
    // Remove any non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Map of country calling codes (expanded)
    const countryCodes = {
        // Asia
        '91': { code: 'IN', name: 'India' },
        '86': { code: 'CN', name: 'China' },
        '81': { code: 'JP', name: 'Japan' },
        '82': { code: 'KR', name: 'South Korea' },
        '852': { code: 'HK', name: 'Hong Kong' },
        '886': { code: 'TW', name: 'Taiwan' },
        '65': { code: 'SG', name: 'Singapore' },
        '60': { code: 'MY', name: 'Malaysia' },
        '66': { code: 'TH', name: 'Thailand' },
        '84': { code: 'VN', name: 'Vietnam' },
        '62': { code: 'ID', name: 'Indonesia' },
        '63': { code: 'PH', name: 'Philippines' },
        '92': { code: 'PK', name: 'Pakistan' },
        '93': { code: 'AF', name: 'Afghanistan' },
        '880': { code: 'BD', name: 'Bangladesh' },
        '94': { code: 'LK', name: 'Sri Lanka' },
        '95': { code: 'MM', name: 'Myanmar' },
        '977': { code: 'NP', name: 'Nepal' },
        '975': { code: 'BT', name: 'Bhutan' },
        '960': { code: 'MV', name: 'Maldives' },
        
        // North America
        '1': { code: 'US', name: 'United States/Canada' },
        
        // Europe
        '44': { code: 'GB', name: 'United Kingdom' },
        '49': { code: 'DE', name: 'Germany' },
        '33': { code: 'FR', name: 'France' },
        '39': { code: 'IT', name: 'Italy' },
        '34': { code: 'ES', name: 'Spain' },
        '31': { code: 'NL', name: 'Netherlands' },
        '32': { code: 'BE', name: 'Belgium' },
        '41': { code: 'CH', name: 'Switzerland' },
        '43': { code: 'AT', name: 'Austria' },
        '46': { code: 'SE', name: 'Sweden' },
        '47': { code: 'NO', name: 'Norway' },
        '45': { code: 'DK', name: 'Denmark' },
        '358': { code: 'FI', name: 'Finland' },
        '48': { code: 'PL', name: 'Poland' },
        '380': { code: 'UA', name: 'Ukraine' },
        '7': { code: 'RU', name: 'Russia' },
        '420': { code: 'CZ', name: 'Czech Republic' },
        '36': { code: 'HU', name: 'Hungary' },
        '30': { code: 'GR', name: 'Greece' },
        '351': { code: 'PT', name: 'Portugal' },
        '353': { code: 'IE', name: 'Ireland' },
        
        // Middle East
        '971': { code: 'AE', name: 'United Arab Emirates' },
        '966': { code: 'SA', name: 'Saudi Arabia' },
        '972': { code: 'IL', name: 'Israel' },
        '90': { code: 'TR', name: 'Turkey' },
        '964': { code: 'IQ', name: 'Iraq' },
        '963': { code: 'SY', name: 'Syria' },
        '961': { code: 'LB', name: 'Lebanon' },
        '962': { code: 'JO', name: 'Jordan' },
        '968': { code: 'OM', name: 'Oman' },
        '974': { code: 'QA', name: 'Qatar' },
        '973': { code: 'BH', name: 'Bahrain' },
        '965': { code: 'KW', name: 'Kuwait' },
        '967': { code: 'YE', name: 'Yemen' },
        
        // South America
        '55': { code: 'BR', name: 'Brazil' },
        '54': { code: 'AR', name: 'Argentina' },
        '56': { code: 'CL', name: 'Chile' },
        '57': { code: 'CO', name: 'Colombia' },
        '51': { code: 'PE', name: 'Peru' },
        '58': { code: 'VE', name: 'Venezuela' },
        
        // North/Central America
        '52': { code: 'MX', name: 'Mexico' },
        '1809': { code: 'DO', name: 'Dominican Republic' },
        '506': { code: 'CR', name: 'Costa Rica' },
        '507': { code: 'PA', name: 'Panama' },
        '503': { code: 'SV', name: 'El Salvador' },
        '502': { code: 'GT', name: 'Guatemala' },
        '504': { code: 'HN', name: 'Honduras' },
        '505': { code: 'NI', name: 'Nicaragua' },
        
        // Africa
        '27': { code: 'ZA', name: 'South Africa' },
        '20': { code: 'EG', name: 'Egypt' },
        '212': { code: 'MA', name: 'Morocco' },
        '234': { code: 'NG', name: 'Nigeria' },
        '254': { code: 'KE', name: 'Kenya' },
        '256': { code: 'UG', name: 'Uganda' },
        '255': { code: 'TZ', name: 'Tanzania' },
        '251': { code: 'ET', name: 'Ethiopia' },
        '233': { code: 'GH', name: 'Ghana' },
        
        // Oceania
        '61': { code: 'AU', name: 'Australia' },
        '64': { code: 'NZ', name: 'New Zealand' },
    };
    
    // Special case for India
    if (cleanNumber.length === 10) {
        return { code: 'IN', name: 'India' };
    }
    
    // Check for country codes from 3 digits down to 1
    for (let length = 3; length >= 1; length--) {
        if (cleanNumber.length >= length) {
            const prefix = cleanNumber.substring(0, length);
            if (countryCodes[prefix]) {
                return countryCodes[prefix];
            }
        }
    }
    
    // Special cases for North America (country code 1)
    if (cleanNumber.startsWith('1')) {
        // Check for Canadian area codes
        const canadianAreaCodes = ['204', '226', '236', '249', '250', '289', '306', '343', '365', '387', '403', '416', '418', '431', '437', '438', '450', '506', '514', '519', '548', '579', '581', '587', '604', '613', '639', '647', '705', '709', '778', '780', '782', '807', '819', '825', '867', '873', '902', '905'];
        
        if (cleanNumber.length >= 4) {
            const areaCode = cleanNumber.substring(1, 4);
            if (canadianAreaCodes.includes(areaCode)) {
                return { code: 'CA', name: 'Canada' };
            } else {
                return { code: 'US', name: 'United States' };
            }
        }
    }
    
    // No match found
    return null;
}

module.exports = lookupPhoneNumber; 