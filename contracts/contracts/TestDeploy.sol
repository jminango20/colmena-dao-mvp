// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract TestDeploy {
    string public message;
    address public owner;
    uint256 public deployedAt;

    event MessageSet(string message, address setter);

    constructor(string memory _initialMessage) {
        message = _initialMessage;
        owner = msg.sender;
        deployedAt = block.timestamp;
    }

    function setMessage(string memory _newMessage) external {
        message = _newMessage;
        emit MessageSet(message, msg.sender);
    }

    function getInfo() external view returns (
        string memory currentMessage,
        address contractOwner,
        uint256 deployTime
    ) {
        return (message, owner, deployedAt);
    }
}