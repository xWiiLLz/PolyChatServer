/**
 * @description Channel, Represents a data transfert object, channel.
 * @author Tanga Mathieu Kaboré
 * @copyright Ecole Polytechnique de Montréal & Course LOG2420
 * @version 1.0.0
 */
class Channel {

    /**
     * Create a new channel.
     * @param {string} id - The unique id of the channel.
     * @param {string} name - The name of the channel.
     * @param {string} password - The password of the channel if private.
     * @param {boolean} status - Since we are sending this DTO to the clients, it will help us to not send too more data
     *  True, if the end user joined this channel / False if not.
     * @param {Array<string>} messages - The list the of the messages in the channel.
     * @param {object} users - Count the users in the channel.
     */
    constructor(id, name, password, status, messages, users = new Map()) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.joinStatus = status;
        this.messages = messages;
        this.users = users;
    }
}

module.exports = Channel;