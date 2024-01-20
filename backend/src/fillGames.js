const axios = require('axios');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });

async function fetchGameFromBGG(id) {
    try {
        const response = await axios.get(`https://boardgamegeek.com/xmlapi/boardgame/${id}`);
        const result = await parser.parseStringPromise(response.data);

        // Check if the response contains an error message
        if (result.boardgames.boardgame[0].error) {
            console.log(`Game with ID ${id} not found or unavailable.`);
            return null;
        }

        return result.boardgames.boardgame[0];
    } catch (error) {
        console.error('Error fetching game with ID', id, ':', error.message);
        return null;
    }
}

function transformGameData(gameData) {
    // Extract and transform data from gameData to match your database schema
    return {
        name: gameData.name.find(n => n.$.primary === 'true')._,
        publisher: gameData.boardgamepublisher ? gameData.boardgamepublisher.map(pub => pub._) : [],
        categories: gameData.boardgamecategory ? gameData.boardgamecategory.map(cat => cat._) : [],
        rating: null, // If available
        play_time: gameData.playingtime[0],
        age: parseInt(gameData.age[0], 10),
        foreign_names: gameData.name.filter(n => !n.$.primary).map(n => n._),
        image: gameData.image ? gameData.image[0] : null, // Extract image URL
        description: gameData.description ? gameData.description[0] : null,
        bgg_id: parseInt(gameData.$.objectid, 10)
    };
}

const db = require('./db'); // Your database module

async function addGameToDatabase(game) {
    try {
        await db.none(
            'INSERT INTO games (name, publisher, categories, rating, play_time, age, foreign_names, image, description, bgg_id) ' +
            'VALUES (${name}, ${publisher}, ${categories}, ${rating}, ${play_time}, ${age}, ${foreign_names}, ${image}, ${description}, ${bgg_id})',
            game
        );
        console.log('Game added:', game.name);
    } catch (error) {
        console.error('Error adding game to database:', error);
    }
}

async function processGames() {
    const startId = 1; // Start ID
    const endId = 1000; // End ID; Amount of games you want to process

    for (let id = startId; id <= endId; id++) {
        const gameData = await fetchGameFromBGG(id);
        if (gameData) {
            const transformedGame = transformGameData(gameData);
            await addGameToDatabase(transformedGame);
        }
    }
}

processGames();