// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "hardhat/console.sol";

interface IERC20 {
    function transfer(address, uint) external returns (bool);

    function transferFrom(address, address, uint) external returns (bool);
}

error CrowdFund__InvaildStartTime();
error CrowdFund__InvaildEndTime();
error CrowdFund__NotOwner();
error CrowdFund__Started();
error CrowdFund__NotStarted();
error CrowdFund__Ended();
error CrowdFund__NotEnded();
error CrowdFund__GoalFail();
error CrowdFund__Claimed();
error CrowdFund__GoalSuccess();

contract CrowdFund {
    event Launch(
        uint id,
        address indexed creator,
        uint goal,
        uint128 startAt,
        uint128 endAt
    );
    event Cancel(uint id);
    event Pledge(uint indexed id, address indexed caller, uint amount);
    event Unpledge(uint indexed id, address indexed caller, uint amount);
    event Claim(uint id);
    event Refund(uint id, address indexed caller, uint amount);

    struct Campaign {
        // Creator of campaign
        address creator;
        // Amount of tokens to raise
        uint goal;
        // Total amount pledged
        uint pledged;
        // Timestamp of start of campaign
        uint128 startAt;
        // Timestamp of end of campaign
        uint128 endAt;
        // True if goal was reached and creator has claimed the tokens.
        bool claimed;
    }

    IERC20 public immutable token;
    // Total count of campaigns created.
    // It is also used to generate id for new campaigns.

    uint public count;
    // Mapping from id to Campaign
    mapping(uint => Campaign) public campaigns;
    // Mapping from campaign id => pledger => amount pledged
    mapping(uint => mapping(address => uint)) public pledgedAmount;

    constructor(address _token) {
        token = IERC20(_token);
    }

    // 创建众筹活动
    function launch(uint _goal, uint128 _startAt, uint128 _endAt) external {
        if (_startAt < block.timestamp) {
            revert CrowdFund__InvaildStartTime();
        }

        if (_endAt < _startAt || _endAt > block.timestamp + 90 days) {
            revert CrowdFund__InvaildEndTime();
        }

        count += 1;
        campaigns[count] = Campaign({
            creator: msg.sender,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });

        emit Launch(count, msg.sender, _goal, _startAt, _endAt);
    }

    function cancel(uint _id) external {
        Campaign memory campaign = campaigns[_id];
        // only creator can cancel
        if (campaign.creator != msg.sender) {
            revert CrowdFund__NotOwner();
        }
        // start activety can't cancel
        if (block.timestamp >= campaign.startAt) {
            revert CrowdFund__Started();
        }

        delete campaigns[_id];
        emit Cancel(_id);
    }

    function pledge(uint _id, uint _amount) external {
        Campaign storage campaign = campaigns[_id];

        if (block.timestamp < campaign.startAt) {
            revert CrowdFund__NotStarted();
        }
        if (block.timestamp > campaign.endAt) {
            revert CrowdFund__Ended();
        }

        campaign.pledged += _amount;
        pledgedAmount[_id][msg.sender] += _amount;
        token.transferFrom(msg.sender, address(this), _amount);

        emit Pledge(_id, msg.sender, _amount);
    }

    function unpledge(uint _id, uint _amount) external {
        Campaign storage campaign = campaigns[_id];
        if (block.timestamp > campaign.endAt) {
            revert CrowdFund__Ended();
        }

        campaign.pledged -= _amount;
        pledgedAmount[_id][msg.sender] -= _amount;
        token.transfer(msg.sender, _amount);

        emit Unpledge(_id, msg.sender, _amount);
    }

    function claim(uint _id) external {
        Campaign storage campaign = campaigns[_id];
        // not owner
        if (campaign.creator != msg.sender) {
            revert CrowdFund__NotOwner();
        }

        // not ended
        if (block.timestamp <= campaign.endAt) {
            revert CrowdFund__NotEnded();
        }

        // goal fail
        if (campaign.pledged < campaign.goal) {
            revert CrowdFund__GoalFail();
        }

        // be claimed
        if (campaign.claimed) {
            revert CrowdFund__Claimed();
        }

        campaign.claimed = true;
        token.transfer(campaign.creator, campaign.pledged);

        emit Claim(_id);
    }

    function refund(uint _id) external {
        Campaign memory campaign = campaigns[_id];

        // not ended
        if (block.timestamp <= campaign.endAt) {
            revert CrowdFund__NotEnded();
        }

        if (campaign.pledged >= campaign.goal) {
            revert CrowdFund__GoalSuccess();
        }

        uint bal = pledgedAmount[_id][msg.sender];
        pledgedAmount[_id][msg.sender] = 0;
        token.transfer(msg.sender, bal);

        emit Refund(_id, msg.sender, bal);
    }
}
