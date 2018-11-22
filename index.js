'use strict';
const queryString = require('query-string');
const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const Channel = require('./models/channel');
const Message = require('./models/channel');
const User = require('./models/user');
const {trySendMessage, limitedLengthArray} = require('./handlers/utils');


const { noUsernameError, usernameInUseError, nonExistingChannel } = require('./handlers/error-handler');
 
const wss = new WebSocket.Server({ port: 3000, path: '/chatservice' });
 
let clients = new Map();

let defaultChannels = [
    new Channel(uuidv1(), 'Général', true, limitedLengthArray(100)),
    new Channel(uuidv1(), 'Équipe 1', false, limitedLengthArray(100)),
    new Channel(uuidv1(), 'Équipe 2', false, limitedLengthArray(100)),
];

/* Socket events */
const onMessage = (payload, user) => {
    const {data, channelId} = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannel(user.client, channelId);
    }

    if (!data) {
        return noMessageError(user.client);
    }

    const targettedChannel = channels.get(channelId);
    const message = JSON.stringify(
        {
            eventType: 'onMessage',
            channelId,
            data,
            sender: user.username,
            timestamp: new Date()
        });
    for (let [username, client] of targettedChannel.clients) {
        trySendMessage(new User(username, client), message);
    }
};

const emitOnGetChannel = (channelId, user) => {
    const message = JSON.stringify(
        {
            eventType: 'onGetChannel',
            channelId,
            data: channels.get(channelId).messages,
            sender: 'Admin',
            timestamp: new Date()
        });
    trySendMessage(user, message);
};

const onGetChannel = (payload, user) => {
    const {channelId} = payload;

    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannel(user.client, channelId);
    }
    emitOnGetChannel(channelId, user);
};

const onCreateChannel = (payload, client) => {

};

const onJoinChannel = (payload, client) => {
    
};


/**
 *
 * @param payload - Deserialized message received from the socket
 * @param user - Object containing
 */
const onLeaveChannel = (payload, user) => {
    
};


const updateChannelsList = (user) => {
    const message = JSON.stringify(
        {
            eventType: 'updateChannelsList',
            channelId: null,
            data: Array.from(channels).map(x => {
                const {id, name, joinStatus, messages, clients} = x[1];
                return {id, name, joinStatus: clients.has(user.username), messages, numberOfUsers: clients.size}
            }),
            sender: 'Admin',
            timestamp: new Date()
        });
    trySendMessage(user, message);
};

const onError = (payload, client) => {
        
};

const supportedEvents = {
    onMessage,
    onCreateChannel,
    onJoinChannel,
    onLeaveChannel,
    updateChannelsList,
    onError
};

let channels = new Map(defaultChannels.map(ch => [
    ch.id, 
    {
        ...ch,
        clients: new Map()
    }
]));

wss.on('connection', (ws, request) => {
    // Initialization
    const { url } = request;
    // console.count(`Client trying to connect with url ${url}`);
    const parsedUrl = queryString.parseUrl(url);
    
    const {username} = parsedUrl.query;

    const user = new User(username, ws);
    if (!username) {
        // console.count('No username was provided... closing socket');
        return noUsernameError(ws);
    }

    if (clients.has(username)) {
        // console.count('Username already in use... closing socket');
        return usernameInUseError(ws);
    }

    // We add the user to our list
    clients.set(username, ws);
    defaultChannels.filter(ch => ch.joinStatus).forEach(ch => {
        addClientToChannel(username, ws, ch.id);
        emitOnGetChannel(ch.id, user);
    });
    console.log(`Client connected with username ${username}`);
    updateAllChannelsList();
    


    ws.on('close', function (ws, code, reason) {
        console.log(`Client with username ${username} disconnected`);
        clients.delete(username);
        for (let [channelName, channel] of channels) {
            if (channel.users.has(username)) {
                channel.users.delete(username);
            }
        }
        updateAllChannelsList();
    });

    ws.on('message', (event) => {
        console.log(`Received message: ${event}`);
        try {
            const deserializedEvent = JSON.parse(event);
            const {eventType} = deserializedEvent;
            if (eventType && supportedEvents.hasOwnProperty(eventType)) {
                supportedEvents[eventType](deserializedEvent, user);
            }
        } catch (e) {
            console.log('An unexpected error occured in the message receiving deserialization routine');
        }
    });

    ws.on('error', (event) => {
        console.log(`Socket error occured with client with username ${user.username}`);
    });
});



const addClientToChannel = (username, client, channelId) => {
    if (!channels.has(channelId)) {
        return nonExistingChannel(client, channelId);
    }
    const channel = channels.get(channelId);
    channel.clients.set(username, client);
};


const updateAllChannelsList = () => {
    for (let [username, client] of clients) {
        updateChannelsList(new User(username, client));
    }
};