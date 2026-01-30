// 1. Configuration
const CONTRACT_ADDRESS = "0x149bc738F6fb650d68D7F85daD1b78Dae88cA2dd"; // Your NEW CA
const RISE_CHAIN_ID = 11155931;
const RISE_RPC_URL = "https://testnet.riselabs.xyz";
const RISE_EXPLORER = "https://testnet-explorer.risechain.com";

const ABI = [
    "function checkIn() external",
    "function getUserData(address) view returns (uint256, uint256)", // returns (lastCheckIn, streak)
    "function getLeaderboard() view returns (address[], uint256[])"
];

// 2. DOM Elements
const connectBtn = document.getElementById("connectBtn");
const checkInBtn = document.getElementById("checkInBtn");
const statusText = document.getElementById("status");
const timerText = document.getElementById("timer");
const streakDisplay = document.getElementById("streakDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const walletBadge = document.getElementById("walletBadge");

let provider, signer, contract;
let countdownInterval;

// 3. Connect Wallet
async function connectWallet() {
    if (window.ethereum) {
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();

            // Auto Network Switch
            const network = await provider.getNetwork();
            if (Number(network.chainId) !== RISE_CHAIN_ID) {
                await switchToRiseNetwork();
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
            }

            contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
            const address = await signer.getAddress();
            
            // Update UI for connection
            walletBadge.innerText = address.substring(0, 6) + "..." + address.substring(38);
            walletBadge.classList.remove("hidden");
            connectBtn.classList.add("hidden");
            checkInBtn.classList.remove("hidden");
            statusText.innerText = "Wallet Connected";

            // Load Data
            await loadUserData();
            await loadLeaderboard();

        } catch (error) {
            console.error(error);
            statusText.innerText = "Connection failed.";
        }
    } else {
        alert("Please install MetaMask!");
    }
}

// 4. Load User Streak & Cooldown
async function loadUserData() {
    if (!contract) return;
    const address = await signer.getAddress();
    
    try {
        const [lastCheckIn, streak] = await contract.getUserData(address);
        
        // Animate streak number
        streakDisplay.innerText = streak.toString();

        const nextCheckInTime = (Number(lastCheckIn) + 86400) * 1000;
        const now = Date.now();

        if (now >= nextCheckInTime) {
            enableButton();
        } else {
            disableButton();
            startCountdown(nextCheckInTime);
        }
    } catch (e) {
        console.error("New user or error:", e);
        // Default to 0 if new user
        streakDisplay.innerText = "0";
        enableButton();
    }
}

// 5. Load Leaderboard
async function loadLeaderboard() {
    if (!contract) return;
    
    try {
        const [users, streaks] = await contract.getLeaderboard();
        
        let leaderboardData = [];
        for(let i = 0; i < users.length; i++) {
            leaderboardData.push({
                address: users[i],
                streak: Number(streaks[i])
            });
        }

        leaderboardData.sort((a, b) => b.streak - a.streak);
        leaderboardList.innerHTML = "";

        if(leaderboardData.length === 0) {
            leaderboardList.innerHTML = "<li style='justify-content:center'>No check-ins yet!</li>";
            return;
        }

        leaderboardData.slice(0, 10).forEach((user, index) => {
            const li = document.createElement("li");
            const shortAddr = user.address.substring(0, 6) + "...";
            
            let rankClass = "";
            let rankIcon = `#${index + 1}`;
            
            if (index === 0) { rankIcon = "🥇"; rankClass = "rank-gold"; }
            if (index === 1) { rankIcon = "🥈"; rankClass = "rank-silver"; }
            if (index === 2) { rankIcon = "🥉"; rankClass = "rank-bronze"; }

            li.innerHTML = `
                <span class="${rankClass}" style="width:30px; font-weight:bold;">${rankIcon}</span>
                <span style="flex-grow:1; margin-left:10px;">${shortAddr}</span>
                <span class="streak-badge">${user.streak} 🔥</span>
            `;
            leaderboardList.appendChild(li);
        });

    } catch (error) {
        console.error("Leaderboard error:", error);
    }
}

// 6. Helpers
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

        timerText.innerText = `Wait: ${hours}h ${minutes}m ${seconds}s`;
        timerText.style.color = "#fbbf24";
    }, 1000);
}

function enableButton() {
    checkInBtn.disabled = false;
    checkInBtn.innerText = "Check In Now";
    timerText.innerText = "You are ready!";
    timerText.style.color = "#10b981";
    if (countdownInterval) clearInterval(countdownInterval);
}

function disableButton() {
    checkInBtn.disabled = true;
    checkInBtn.innerText = "Cooldown Active";
    timerText.style.color = "#fbbf24";
}

async function switchToRiseNetwork() {
    const chainIdHex = "0x" + RISE_CHAIN_ID.toString(16);
    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
        });
    } catch (error) {
        if (error.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: chainIdHex,
                    chainName: "Rise Testnet",
                    rpcUrls: [RISE_RPC_URL],
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    blockExplorerUrls: [RISE_EXPLORER]
                }],
            });
        }
    }
}

// 7. Check In Action
async function handleCheckIn() {
    try {
        statusText.innerText = "Confirm transaction in wallet...";
        const tx = await contract.checkIn();
        
        statusText.innerText = "Transaction sent... waiting...";
        checkInBtn.disabled = true;
        checkInBtn.innerText = "Processing...";
        
        await tx.wait();
        
        statusText.innerText = "✅ Checked In Successfully!";
        await loadUserData();
        await loadLeaderboard();
        
    } catch (error) {
        console.error("Error:", error);
        statusText.innerText = "Transaction Failed.";
        checkInBtn.disabled = false;
        checkInBtn.innerText = "Check In Now";
    }
}

connectBtn.addEventListener("click", connectWallet);
checkInBtn.addEventListener("click", handleCheckIn);
