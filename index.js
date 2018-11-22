'use strict';

const queryString = require('query-string');
const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const Channel = require('./models/channel');
const Message = require('./models/message');
const User = require('./models/user');
const {trySendMessage, limitedLengthArray} = require('./handlers/utils');


const { noUsernameError, usernameInUseError, nonExistingChannelError, noMessageError, noChannelNameError, channelNameLengthError, wrongWayAroundError } = require('./handlers/error-handler');
 
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
        return nonExistingChannelError(user.client, channelId);
    }

    if (!data) {
        return noMessageError(user.client);
    }

    const targettedChannel = channels.get(channelId);
    const timestamp = new Date();
    const message = JSON.stringify(
        {
            eventType: 'onMessage',
            channelId,
            data,
            sender: user.username,
            timestamp
        });
    targettedChannel.messages.push(new Message(null, channelId, data, user.username, timestamp));

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
        return nonExistingChannelError(user.client, channelId);
    }
    emitOnGetChannel(channelId, user);
};

const onCreateChannel = (payload, user) => {
    const { data } = payload;
    if (!data) {
        return noChannelNameError(user.client);
    }

    if (data.length < 5 || data.length > 20) {
        return channelNameLengthError(user.client);
    }

    let uuid;
    do {
        uuid = uuidv1();
    } while(channels.has(uuid));
    channels.set(uuid, {
        ...new Channel(uuid, data, true, limitedLengthArray(100)),
        clients: new Map()
    });
    updateAllChannelsList();
};

const onJoinChannel = (payload, user) => {
    const { channelId } = payload;
    addClientToChannel(user, channelId);

    // Notify all channel's users
    const channel = channels.get(channelId);
    for (let [username, client] of channel.clients) {
        updateChannelsList(null, new User(username, client));
    }
};


/**
 *
 * @param payload - Deserialized message received from the socket
 * @param user - Object containing
 */
const onLeaveChannel = (payload, user) => {
    const { channelId } = payload;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(client, channelId);
    }

    // Notify all channel's users
    removeClientFromChannel(user, channelId);
    const channel = channels.get(channelId);
    for (let [username, client] of channel.clients) {
        updateChannelsList(null, new User(username, client));
    }
};


const updateChannelsList = (payload, user) => {
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

const onError = (payload, user) => {
    return wrongWayAroundError(user.client);
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
        addClientToChannel(user, ch.id);
    });

    console.log(`Client connected with username ${username}`);
    updateAllChannelsList();

    defaultChannels.filter(ch => ch.joinStatus).forEach(ch => {
        emitOnGetChannel(ch.id, user);
    });


    ws.on('close', function (ws, code, reason) {
        console.log(`Client with username ${username} disconnected`);
        clients.delete(username);
        for (let [channelId, channel] of channels) {
            if (channel.clients.has(username)) {
                removeClientFromChannel(user, channelId);
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



const addClientToChannel = (user, channelId) => {
    const {username, client} = user;
    if (!channelId || !channels.has(channelId)) {
        return nonExistingChannelError(client, channelId);
    }
    const channel = channels.get(channelId);

    if (channel.clients.has(username)) {
        return;
    }

    channel.clients.set(username, client);

    const data = `${username} a rejoint le groupe`;
    const timestamp = new Date();
    const joinedMessage = JSON.stringify({
        eventType: 'onMessage',
        channelId,
        data,
        sender: 'Admin',
        timestamp
    });
    channel.messages.push(new Message(null, channelId, data, 'Admin', timestamp));
    channel.clients.forEach(client => {
       trySendMessage({client}, joinedMessage);
    });
};

const removeClientFromChannel = (user, channelId) => {
    if (!channelId || !channels.has(channelId)) {
        return;
    }
    const channel = channels.get(channelId);
    channel.clients.delete(user.username);

    const data = `${user.username} a quitté le groupe`;
    const timestamp = new Date();

    const leftMessage = JSON.stringify({
        eventType: 'onMessage',
        channelId,
        data,
        sender: 'Admin',
        timestamp
    });
    channel.messages.push(new Message(null, channelId, data, 'Admin', timestamp));

    channel.clients.forEach(client => {
        trySendMessage({client}, leftMessage);
    });
};

const updateAllChannelsList = () => {
    for (let [username, client] of clients) {
        updateChannelsList(null, new User(username, client));
    }
};