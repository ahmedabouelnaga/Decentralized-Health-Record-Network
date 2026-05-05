// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HealthRegistry} from "../src/HealthRegistry.sol";

contract DeployHealthRegistry is Script {
    function run() external returns (HealthRegistry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        HealthRegistry registry = new HealthRegistry();
        vm.stopBroadcast();
        console.log("HealthRegistry deployed at:", address(registry));
        return registry;
    }
}
