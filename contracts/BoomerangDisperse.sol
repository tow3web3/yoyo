// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BoomerangDisperse
/// @notice One transaction pays many holders. Optional: when DISPERSE_ADDRESS is
/// set in the backend, dividends go out in batches of up to 150 recipients
/// instead of one transfer per holder. Stateless, no owner, no funds retained.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BoomerangDisperse {
    error LengthMismatch();
    error EtherTransferFailed(address to);
    error TokenTransferFailed(address to);
    error RefundFailed();

    /// @notice Send ETH to each recipient. Any leftover value is refunded.
    function disperseEther(address[] calldata recipients, uint256[] calldata values) external payable {
        if (recipients.length != values.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i = 0; i < recipients.length; i++) {
            (bool ok, ) = recipients[i].call{value: values[i]}("");
            if (!ok) revert EtherTransferFailed(recipients[i]);
            total += values[i];
        }
        uint256 leftover = msg.value - total;
        if (leftover > 0) {
            (bool ok, ) = msg.sender.call{value: leftover}("");
            if (!ok) revert RefundFailed();
        }
    }

    /// @notice Send an ERC-20 to each recipient. Caller must approve this contract first.
    function disperseToken(address token, address[] calldata recipients, uint256[] calldata values) external {
        if (recipients.length != values.length) revert LengthMismatch();
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!IERC20(token).transferFrom(msg.sender, recipients[i], values[i])) revert TokenTransferFailed(recipients[i]);
        }
    }
}
