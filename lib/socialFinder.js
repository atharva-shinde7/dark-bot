const axios = require('axios');

/**
 * Find social profiles linked to a phone number or email
 * @param {string} input - Phone number or email to search
 * @returns {Promise<Object>} - Found social profiles
 */
async function findSocialProfiles(input) {
    try {
        console.log(`Searching for social profiles linked to: ${input}`);
        
        // Determine if input is email or phone number
        const isEmail = input.includes('@');
        const inputType = isEmail ? 'email' : 'phone';
        
        // Initialize results
        const results = {
            input: input,
            inputType: inputType,
            profiles: [],
            possibleMatches: [],
            metadata: {}
        };
        
        // Try multiple methods to find social profiles (free methods only)
        await Promise.allSettled([
            tryEmailRepAPI(input, results), // Free with rate limits
            tryDirectSearch(input, results), // Uses Serper API (free tier)
            tryGravatar(input, results),     // Free
            tryPhoneInfoAPI(input, results)  // Uses existing APIs
        ]);
        
        return results;
    } catch (error) {
        console.error('Social profile search error:', error.message);
        throw new Error('Failed to search for social profiles');
    }
}

/**
 * Try EmailRep API for reputation and social account discovery (free with rate limits)
 * @param {string} input - Email or phone
 * @param {Object} results - Results object to add findings to
 */
async function tryEmailRepAPI(input, results) {
    if (!input.includes('@')) return; // Only works with emails
    
    try {
        // EmailRep allows limited free API calls without a key
        const response = await axios.get(`https://emailrep.io/${encodeURIComponent(input)}`, {
            headers: {
                'User-Agent': 'WhatsApp Bot (Open Source Project)'
            },
            timeout: 5000
        });
        
        if (response.data) {
            // Add reputation data
            results.metadata.reputation = {
                score: response.data.reputation || 'unknown',
                suspicious: response.data.suspicious || false,
                blacklisted: response.data.details?.blacklisted || false,
                malicious_activity: response.data.details?.malicious_activity || false,
                credentials_leaked: response.data.details?.credentials_leaked || false
            };
            
            // Add social profiles found
            if (response.data.details && response.data.details.profiles) {
                response.data.details.profiles.forEach(profile => {
                    results.possibleMatches.push({
                        network: profile,
                        source: 'emailrep.io'
                    });
                });
            }
        }
    } catch (error) {
        console.log('EmailRep API error:', error.message);
    }
}

/**
 * Try Gravatar profile lookup (completely free)
 * @param {string} input - Email
 * @param {Object} results - Results object to add findings to
 */
async function tryGravatar(input, results) {
    if (!input.includes('@')) return; // Only works with emails
    
    try {
        // Create MD5 hash of email for Gravatar
        const emailHash = require('crypto').createHash('md5').update(input.trim().toLowerCase()).digest('hex');
        
        // Check if Gravatar profile exists
        try {
            const gravatarResponse = await axios.get(`https://en.gravatar.com/${emailHash}.json`, {
                timeout: 5000
            });
            
            if (gravatarResponse.data && gravatarResponse.data.entry && gravatarResponse.data.entry.length > 0) {
                const profile = gravatarResponse.data.entry[0];
                
                // Add basic profile info
                if (profile.displayName) {
                    results.metadata.name = {
                        fullName: profile.displayName || '',
                        firstName: profile.name?.givenName || '',
                        lastName: profile.name?.familyName || ''
                    };
                }
                
                // Add Gravatar profile
                results.profiles.push({
                    network: 'Gravatar',
                    url: `https://gravatar.com/${profile.preferredUsername || emailHash}`,
                    username: profile.preferredUsername || '',
                    source: 'gravatar'
                });
                
                // Add linked accounts
                if (profile.accounts && profile.accounts.length > 0) {
                    profile.accounts.forEach(account => {
                        let network = account.shortname || account.name || account.domain || '';
                        network = network.charAt(0).toUpperCase() + network.slice(1); // Capitalize
                        
                        results.profiles.push({
                            network: network,
                            url: account.url || '',
                            username: account.username || account.display || '',
                            source: 'gravatar'
                        });
                    });
                }
            }
        } catch (error) {
            // 404 error is common if no Gravatar profile exists
            if (error.response && error.response.status !== 404) {
                console.log('Gravatar profile error:', error.message);
            }
            
            // Even if profile lookup fails, try to get the avatar
            results.metadata.gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=404`;
        }
    } catch (error) {
        console.log('Gravatar error:', error.message);
    }
}

/**
 * Try phone number info API for social information
 * @param {string} phone - Phone number
 * @param {Object} results - Results object to add findings to
 */
async function tryPhoneInfoAPI(input, results) {
    if (input.includes('@')) return; // Only for phone numbers
    
    try {
        // Clean the phone number
        const cleanPhone = input.replace(/\D/g, '');
        
        // Use NumLookupAPI if available
        if (process.env.NUMLOOKUP_API_KEY) {
            const response = await axios.get(`https://numlookupapi.com/api/v1/phone/${cleanPhone}`, {
                params: {
                    apikey: process.env.NUMLOOKUP_API_KEY
                },
                timeout: 5000
            });
            
            if (response.data) {
                // Add carrier and location info
                results.metadata.phoneInfo = {
                    carrier: response.data.carrier || 'unknown',
                    line_type: response.data.line_type || 'unknown',
                    country: response.data.country_name || 'unknown',
                    location: response.data.location || 'unknown'
                };
            }
        } else {
            // Use AbstractAPI as alternative if available
            if (process.env.ABSTRACT_API_KEY) {
                const response = await axios.get(`https://phonevalidation.abstractapi.com/v1/`, {
                    params: {
                        api_key: process.env.ABSTRACT_API_KEY,
                        phone: cleanPhone
                    },
                    timeout: 5000
                });
                
                if (response.data) {
                    results.metadata.phoneInfo = {
                        carrier: response.data.carrier || 'unknown',
                        line_type: response.data.type || 'unknown',
                        country: response.data.country?.name || 'unknown',
                        location: response.data.location || 'unknown'
                    };
                }
            } else {
                // Basic country detection from phone number
                const countryInfo = identifyCountryFromNumber(cleanPhone);
                if (countryInfo) {
                    results.metadata.phoneInfo = {
                        country: countryInfo.name || 'unknown',
                        countryCode: countryInfo.code || 'unknown'
                    };
                }
            }
        }
    } catch (error) {
        console.log('Phone info API error:', error.message);
    }
}

/**
 * Use direct search techniques to find social profiles
 * @param {string} input - Email or phone
 * @param {Object} results - Results object to add findings to
 */
async function tryDirectSearch(input, results) {
    try {
        const isEmail = input.includes('@');
        const searchQuery = isEmail 
            ? `"${input}" site:facebook.com OR site:linkedin.com OR site:instagram.com OR site:twitter.com`
            : `"${input}" profile OR contact`;
        
        // Try to search with Serper API if available
        if (process.env.SERPER_API_KEY) {
            const response = await axios.post('https://google.serper.dev/search', {
                q: searchQuery,
                gl: 'us',
                hl: 'en',
                num: 10
            }, {
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            if (response.data && response.data.organic) {
                response.data.organic.forEach(result => {
                    const url = result.link;
                    if (url) {
                        // Check if this is a social media profile
                        if (url.includes('facebook.com/') && !url.includes('facebook.com/pages/')) {
                            results.possibleMatches.push({
                                network: 'Facebook',
                                url: url,
                                title: result.title || '',
                                source: 'search'
                            });
                        } else if (url.includes('linkedin.com/in/')) {
                            results.possibleMatches.push({
                                network: 'LinkedIn',
                                url: url,
                                title: result.title || '',
                                source: 'search'
                            });
                        } else if (url.includes('instagram.com/') && !url.includes('instagram.com/p/')) {
                            results.possibleMatches.push({
                                network: 'Instagram',
                                url: url,
                                title: result.title || '',
                                source: 'search'
                            });
                        } else if (url.includes('twitter.com/') && !url.includes('twitter.com/status/')) {
                            results.possibleMatches.push({
                                network: 'Twitter',
                                url: url,
                                title: result.title || '',
                                source: 'search'
                            });
                        } else if (url.includes('github.com/') && !url.includes('github.com/topics/')) {
                            results.possibleMatches.push({
                                network: 'GitHub',
                                url: url,
                                title: result.title || '',
                                source: 'search'
                            });
                        }
                    }
                });
            }
        } else {
            // Use Duckduckgo API through a proxy (as fallback)
            try {
                const response = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&pretty=0`, {
                    timeout: 5000
                });
                
                if (response.data && response.data.Results) {
                    response.data.Results.forEach(result => {
                        const url = result.FirstURL;
                        if (url && isSocialMediaUrl(url)) {
                            results.possibleMatches.push({
                                network: getSocialNetworkFromUrl(url),
                                url: url,
                                title: result.Text || '',
                                source: 'duckduckgo'
                            });
                        }
                    });
                }
            } catch (error) {
                console.log('DuckDuckGo search error:', error.message);
            }
        }
    } catch (error) {
        console.log('Direct search error:', error.message);
    }
}

/**
 * Check if a URL is from a social media site
 * @param {string} url - URL to check
 * @returns {boolean} - True if social media URL
 */
function isSocialMediaUrl(url) {
    const socialDomains = [
        'facebook.com', 
        'linkedin.com', 
        'instagram.com', 
        'twitter.com',
        'github.com',
        'youtube.com',
        'pinterest.com',
        'reddit.com',
        'tiktok.com',
        'snapchat.com'
    ];
    
    return socialDomains.some(domain => url.includes(domain));
}

/**
 * Get social network name from URL
 * @param {string} url - Social media URL
 * @returns {string} - Social network name
 */
function getSocialNetworkFromUrl(url) {
    url = url.toLowerCase();
    if (url.includes('facebook.com')) return 'Facebook';
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('twitter.com')) return 'Twitter';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('github.com')) return 'GitHub';
    if (url.includes('youtube.com')) return 'YouTube';
    if (url.includes('pinterest.com')) return 'Pinterest';
    if (url.includes('reddit.com')) return 'Reddit';
    if (url.includes('tiktok.com')) return 'TikTok';
    if (url.includes('snapchat.com')) return 'Snapchat';
    
    // Extract domain if no match
    const domain = url.replace(/^https?:\/\//, '')
                      .replace(/www\./, '')
                      .split('/')[0]
                      .split('.')[0];
    
    return domain.charAt(0).toUpperCase() + domain.slice(1);
}

/**
 * Basic function to identify country from phone number's country code
 * @param {string} phoneNumber - Phone number
 * @returns {Object|null} - Country code info or null
 */
function identifyCountryFromNumber(phoneNumber) {
    // Remove any non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    // Map of common country calling codes
    const countryCodes = {
        '91': { code: 'IN', name: 'India' },
        '1': { code: 'US', name: 'United States' },
        '44': { code: 'GB', name: 'United Kingdom' },
        '86': { code: 'CN', name: 'China' },
        '49': { code: 'DE', name: 'Germany' },
        '33': { code: 'FR', name: 'France' },
        '39': { code: 'IT', name: 'Italy' },
        '7': { code: 'RU', name: 'Russia' },
        '34': { code: 'ES', name: 'Spain' },
        '55': { code: 'BR', name: 'Brazil' },
        '81': { code: 'JP', name: 'Japan' },
        '82': { code: 'KR', name: 'South Korea' },
        '61': { code: 'AU', name: 'Australia' },
        '52': { code: 'MX', name: 'Mexico' },
        '62': { code: 'ID', name: 'Indonesia' },
        '966': { code: 'SA', name: 'Saudi Arabia' },
        '971': { code: 'AE', name: 'United Arab Emirates' },
        '65': { code: 'SG', name: 'Singapore' },
        '60': { code: 'MY', name: 'Malaysia' },
        '63': { code: 'PH', name: 'Philippines' }
    };
    
    // Check longest country codes first
    const countryCodeLengths = [3, 2, 1];
    for (const length of countryCodeLengths) {
        if (cleanNumber.length >= length) {
            const prefix = cleanNumber.substring(0, length);
            if (countryCodes[prefix]) {
                return countryCodes[prefix];
            }
        }
    }
    
    return null;
}

module.exports = findSocialProfiles; 