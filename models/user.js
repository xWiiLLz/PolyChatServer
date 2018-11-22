class User {
    /**
     * Creates an user
     * @param username - The chosen username
     * @param client - The associated client (websocket)
     */
    constructor(username, client) {
        this.username = username;
        this.client = client;
    }
}

module.exports = User;