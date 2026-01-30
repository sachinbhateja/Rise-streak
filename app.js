// 1. Configuration
const CONTRACT_ADDRESS = "0xEAEe20a539C550515e22BCaD3eD5e0832b59d1d6"; // Your specific address
const RISE_CHAIN_ID = 11155931; // Rise Testnet Chain ID (Decimal)
const RISE_RPC_URL = "https://testnet.riselabs.xyz";
const RISE_EXPLORER = "https://testnet-explorer.risechain.com";

const ABI = [
    "function checkIn() external",
    "function lastCheckIn(address) view returns (uint256)"
];

// 2. DOM Elements
const connectBtn = document.getElementById("connectBtn");
const checkInBtn = document.getElementById("checkInBtn");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");

// 3. Global Variables
let provider, signer, contract;
let countdownInterval;

// 4. Connect Wallet Function
async function connectWallet() {
    if (window.ethereum) {
        try {
            // Request account access
            await window.ethereum.request({ method: "eth_requestAccounts" });
            
            // Initialize Ethers provider
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            // --- AUTO NETWORK SWITCH START ---
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== RISE_CHAIN_ID) {
                try {
                    await switchToRiseNetwork();
                    // Re-initialize provider after switch to be safe
                    provider = new ethers.BrowserProvider(window.ethereum);
                    signer = await provider.getSigner();
                } catch (switchError) {
                    console.error("Failed to switch network:", switchError);
                    statusText.innerText = "Please switch to Rise Testnet manually.";
                    return;
                }
            }
            // --- AUTO NETWORK SWITCH END ---

            // Initialize Contract
            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

            const address = await signer.getAddress();
            statusText.innerText = "Connected: " + address.substring(0, 6) + "...";
            connectBtn.style.display = "none";

            // Check if user can check in
            await checkStatus();

        } catch (error) {
            console.error(error);
            statusText.innerText = "Connection failed.";
        }
    } else {
        alert("Please install MetaMask!");
    }
}

// 5. Network Switcher Logic
async function switchToRiseNetwork() {
    const chainIdHex = "0x" + RISE_CHAIN_ID.toString(16); // Convert 11155931 to Hex
    
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
        });
    } catch (error) {
        // This error code 4902 means the chain has not been added to MetaMask
        if (error.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: chainIdHex,
                    chainName: "Rise Testnet",
                    rpcUrls: [RISE_RPC_URL],
                    nativeCurrency: {
                        name: "ETH",
                        symbol: "ETH",
                        decimals: 18
                    },
                    blockExplorerUrls: [RISE_EXPLORER]
                }],
            });
        } else {
            throw error;
        }
    }
}

// 6. Check User Status (Cooldown Logic)
async function checkStatus() {
    if (!contract) return;

    try {
        const address = await signer.getAddress();
        const lastCheckIn = await contract.lastCheckIn(address);
        
        // Convert timestamp to milliseconds (Solidity returns seconds)
        // Add 24 hours (86400 seconds)
        const nextCheckInTime = (Number(lastCheckIn) + 86400) * 1000;
        const now = Date.now();

        if (now >= nextCheckInTime) {
            enableButton();
        } else {
            disableButton();
            startCountdown(nextCheckInTime);
        }

    } catch (error) {
        console.error("Error fetching status:", error);
    }
}

// 7. Countdown Timer
function startCountdown(targetTime) {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const now = Date.now();
        const distance = targetTime - now;

        if (distance < 0) {
            clearInterval(countdownInterval);
            enableButton();
            return;
        }

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerText.innerText = `Next check-in: ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

// 8. UI Helpers
function enableButton() {
    checkInBtn.disabled = false;
    checkInBtn.innerText = "Check In Now";
    timerText.innerText = "You are ready to check in! 🚀";
    timerText.style.color = "#10b981"; // Green
    if (countdownInterval) clearInterval(countdownInterval);
}

function disableButton() {
    checkInBtn.disabled = true;
    checkInBtn.innerText = "Come back later";
    timerText.style.color = "#facc15"; // Yellow
}

// 9. Execute Check-In Transaction
async function handleCheckIn() {
    try {
        statusText.innerText = "Please confirm transaction...";
        
        const tx = await contract.checkIn();
        statusText.innerText = "Waiting for confirmation...";
        
        await tx.wait();
        
        statusText.innerText = "✅ Checked In!";
        await checkStatus(); // Restart timer immediately
        
    } catch (error) {
        console.error("Error:", error);
        if (error.reason && error.reason.includes("Come back tomorrow")) {
            statusText.innerText = "⏳ Cooldown active.";
        } else {
            statusText.innerText = "❌ Transaction Failed.";
        }
    }
}

// 10. Event Listeners
connectBtn.addEventListener("click", connectWallet);
checkInBtn.addEventListener("click", handleCheckIn);
