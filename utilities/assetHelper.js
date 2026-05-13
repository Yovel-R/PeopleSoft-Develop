const axios = require('axios');

/**
 * Helper to fetch image/file buffer from URL
 */
async function getAssetBuffer(url) {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Error fetching asset from ${url}:`, error.message);
        return null;
    }
}

module.exports = { getAssetBuffer };
