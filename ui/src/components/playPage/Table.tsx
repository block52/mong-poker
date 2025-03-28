import { useEffect, useState } from "react";
import { playerPosition, chipPosition, dealerPosition } from "../../utils/PositionArray";
import PokerActionPanel from "../Footer";
import PokerLog from "../PokerLog";
import OppositePlayerCards from "./Card/OppositePlayerCards";
import VacantPlayer from "./Players/VacantPlayer";
import OppositePlayer from "./Players/OppositePlayer";
import Player from "./Players/Player";
// import { usePlayerContext } from "../../context/usePlayerContext";
import TurnAnimation from "./TurnAnimation/TurnAnimation";
import { LuPanelLeftOpen } from "react-icons/lu";
import { RiMoneyDollarCircleLine } from "react-icons/ri";
import { LuPanelLeftClose } from "react-icons/lu";
import useUserWallet from "../../hooks/useUserWallet"; // this is the browser wallet
import { useNavigate, useParams } from "react-router-dom";
import { IoMenuSharp } from "react-icons/io5";

import { ethers } from "ethers";
import { useTableContext } from "../../context/TableContext";
import { FaCopy } from "react-icons/fa";
import React from "react";
import { formatWeiToSimpleDollars, formatWeiToUSD } from "../../utils/numberUtils";

// Enable this to see verbose logging
const DEBUG_MODE = false;

// Helper function that only logs when DEBUG_MODE is true
const debugLog = (...args: any[]) => {
    if (DEBUG_MODE) {
        console.log(...args);
    }
};

//* Here's the typical sequence of a poker hand:
//* ANTE - Initial forced bets
//* PREFLOP - Players get their hole cards, betting round
//* FLOP - First 3 community cards dealt, betting round
//* TURN - Fourth community card dealt, betting round
//* RIVER - Final community card dealt, final betting round
//* SHOWDOWN - Players show their cards to determine winner

//* Define the interface for the position object
interface PositionArray {
    left?: string;
    top?: string;
    bottom?: string;
    right?: string;
    color?: string;
}

const calculateZoom = () => {
    const baseWidth = 1600;
    const baseHeight = 850;
    const headerFooterHeight = 180;

    const availableHeight = window.innerHeight - headerFooterHeight;
    const scaleWidth = window.innerWidth / baseWidth;
    const scaleHeight = availableHeight / baseHeight;

    const calculatedScale = Math.min(scaleWidth, scaleHeight);
    return Math.min(calculatedScale, 2); // Cap at 2x
};

const useTableData = () => {
    const { tableData, isLoading, error } = useTableContext();

    // Default empty state
    const emptyState = {
        isLoading: false,
        error: null,
        tableDataType: "cash",
        tableDataAddress: "",
        tableDataSmallBlind: "0.00",
        tableDataBigBlind: "0.00",
        tableDataSmallBlindPosition: 0,
        tableDataBigBlindPosition: 0,
        tableDataDealer: 0,
        tableDataPlayers: [],
        tableDataCommunityCards: [],
        tableDataDeck: "",
        tableDataPots: ["0"],
        tableDataNextToAct: -1,
        tableDataRound: "preflop",
        tableDataWinners: [],
        tableDataSignature: ""
    };

    if (isLoading) {
        return { ...emptyState, isLoading: true };
    }

    if (error) {
        return { ...emptyState, error };
    }

    const data = tableData?.data;
    if (!data || data.type !== "cash") {
        return emptyState;
    }

    return {
        isLoading: false,
        error: null,
        tableDataType: data.type,
        tableDataAddress: data.address,
        tableDataSmallBlind: formatWeiToSimpleDollars(data.smallBlind),
        tableDataBigBlind: formatWeiToSimpleDollars(data.bigBlind),
        tableDataSmallBlindPosition: data.smallBlindPosition,
        tableDataBigBlindPosition: data.bigBlindPosition,
        tableDataDealer: data.dealer,
        tableDataPlayers: data.players || [],
        tableDataCommunityCards: data.communityCards || [],
        tableDataDeck: data.deck || "",
        tableDataPots: data.pots || ["0"],
        tableDataNextToAct: data.nextToAct ?? -1,
        tableDataRound: data.round || "preflop",
        tableDataWinners: data.winners || [],
        tableDataSignature: data.signature || ""
    };
};

// Helper function to format Wei to USD with commas


const Table = () => {
    const { id } = useParams<{ id: string }>();
    const {
        tableData,
        nextToActInfo,
        currentRound,
        totalPot,
        playerLegalActions,
        isPlayerTurn,
        tableSize,
        openOneMore,
        openTwoMore,
        showThreeCards,
        getUserBySeat,
        currentUserSeat
    } = useTableContext();

    // Keep the existing variable
    const currentUserAddress = localStorage.getItem("user_eth_public_key");
    debugLog("Current user address from localStorage:", currentUserAddress);

    // Create a different variable for comparison purposes
    const userWalletAddress = React.useMemo(() => {
        return currentUserAddress ? currentUserAddress.toLowerCase() : null;
    }, [currentUserAddress]);

    // Add the new hook usage here with prefixed names - directly at top level, not inside useMemo
    const tableDataValues = useTableData();

    // Replace useUserBySeat with getUserBySeat from context
    // Get the user data for the current seat from context instead of hook
    const userData = React.useMemo(() => {
        if (currentUserSeat >= 0) {
            return getUserBySeat(currentUserSeat);
        }
        return null;
    }, [currentUserSeat, getUserBySeat]);

    // Define activePlayers only once
    const activePlayers = tableDataValues.tableDataPlayers?.filter((player: any) => player.address !== "0x0000000000000000000000000000000000000000") ?? [];

    useEffect(() => {
        if (!DEBUG_MODE) return; // Skip logging if not in debug mode

        debugLog("Active Players:", activePlayers);
        // If there are active players, set their positions
        if (activePlayers.length > 0) {
            // Player in seat 0
            if (activePlayers.find((p: any) => p.seat === 0)) {
                const player0 = activePlayers.find((p: any) => p.seat === 0);
                debugLog("Player 0:", player0);
            }

            // Player in seat 1
            if (activePlayers.find((p: any) => p.seat === 1)) {
                const player1 = activePlayers.find((p: any) => p.seat === 1);
                debugLog("Player 1:", player1);
            }
        }
    }, [activePlayers]);

    // Early return if no id
    if (!id) {
        return <div className="h-screen flex items-center justify-center text-white">Invalid table ID</div>;
    }

    // Add any variables we need
    const [seat, setSeat] = useState<number>(0);
    // Add dealerIndex state here at the top with other state hooks
    const [dealerIndex, setDealerIndex] = useState<number>(0);

    // Handle loading state

    const [currentIndex, setCurrentIndex] = useState<number>(1);
    // const [type, setType] = useState<string | null>(null);
    const [startIndex, setStartIndex] = useState<number>(0);

    const [playerPositionArray, setPlayerPositionArray] = useState<PositionArray[]>([]);
    const [chipPositionArray, setChipPositionArray] = useState<PositionArray[]>([]);
    const [dealerPositionArray, setDealerPositionArray] = useState<PositionArray[]>([]);
    const [zoom, setZoom] = useState(calculateZoom());
    const [openSidebar, setOpenSidebar] = useState(false);

    const [userSeat, setUserSeat] = useState<number | null>(null);  
    const [userNFT, setUserNFT] = useState<string | null>(null);
   
    const [flipped1, setFlipped1] = useState(false);
    const [flipped2, setFlipped2] = useState(false);
    const [flipped3, setFlipped3] = useState(false);
    const [isCardVisible, setCardVisible] = useState(-1);

    const navigate = useNavigate();

    const { account, balance, isLoading: walletLoading } = useUserWallet(); // this is the wallet in the browser.

    const [dealerButtonPosition, setDealerButtonPosition] = useState({ left: "0px", top: "0px" });
    const [isDealerButtonVisible, setIsDealerButtonVisible] = useState(false);



    useEffect(() => {
        const savedNFT = localStorage.getItem("selectedNFT");
        if (savedNFT) {
            setUserNFT(savedNFT);
        } else {
            setUserNFT("https://ipfs.io/ipfs/bafybeiafzj33jeqrkbjjqjwprsctvstryo7p4w5ut32gu7762574g73wfa"); // Default NFT
        }
    }, []);


    // Add state for mouse position
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // Add effect to track mouse movement
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Calculate mouse position as percentage of window
            const x = (e.clientX / window.innerWidth) * 100;
            const y = (e.clientY / window.innerHeight) * 100;
            setMousePosition({ x, y });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    useEffect(() => {
        if (tableData?.data) {
            try {
                // Handle dealer button
                if (tableData.data.dealer !== undefined && tableData.data.dealer !== null) {
                    const dealerSeat = tableData.data.dealer === 9 ? 0 : tableData.data.dealer;
                    const dealerPos = dealerPosition.nine[dealerSeat];

                    if (dealerPos) {
                        // Just set the original position
                        setDealerButtonPosition({
                            left: dealerPos.left,
                            top: dealerPos.top
                        });
                        setIsDealerButtonVisible(true);
                    }
                }
            } catch (error) {
                console.error("Error setting position indicators:", error);
            }
        }
    }, [tableData?.data?.address, tableData?.data?.dealer, tableData?.data?.smallBlindPosition, tableData?.data?.bigBlindPosition]); // Only update when important positions change

    useEffect(() => (seat ? setStartIndex(seat) : setStartIndex(0)), [seat]);

    useEffect(() => {
        const reorderedPlayerArray = [...playerPositionArray.slice(startIndex), ...playerPositionArray.slice(0, startIndex)];
        const reorderedDealerArray = [...dealerPositionArray.slice(startIndex), ...dealerPositionArray.slice(0, startIndex)];
        const reorderedChipArray = [...chipPositionArray.slice(startIndex), ...chipPositionArray.slice(0, startIndex)];
        setPlayerPositionArray(reorderedPlayerArray);
        setChipPositionArray(reorderedChipArray);
        setDealerPositionArray(reorderedDealerArray);
    }, [startIndex]);

    function threeCardsTable() {
        setTimeout(() => {
            setFlipped1(true);
        }, 1000);
        setTimeout(() => {
            setFlipped2(true);
        }, 1100);
        setTimeout(() => {
            setFlipped3(true);
        }, 1200);
    }

    useEffect(() => {
        if (showThreeCards) {
            threeCardsTable();
        }
    }, [showThreeCards]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentIndex(prevIndex => {
                if (prevIndex === 2) {
                    // Handle case where prevIndex is 2 (e.g., no change or custom logic)
                    return prevIndex + 2; // For example, keep it the same
                } else if (prevIndex === 4) {
                    // If prevIndex is 4, increment by 2
                    return prevIndex + 2;
                } else if (prevIndex === 9) {
                    // If prevIndex is 4, increment by 2
                    return prevIndex - 8;
                } else {
                    // Otherwise, just increment by 1
                    return prevIndex + 1;
                }
            });
        }, 30000);

        // Cleanup the timer on component unmount
        return () => clearTimeout(timer);
    }, [currentIndex]);

    useEffect(() => {
        const handleResize = () => setZoom(calculateZoom());
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        //* set the number of players
        switch (tableSize) {
            case 6:
                setPlayerPositionArray(playerPosition.six);
                setChipPositionArray(chipPosition.six);
                setDealerPositionArray(dealerPosition.six);
                break;
            case 9:
                setPlayerPositionArray(playerPosition.nine);
                setChipPositionArray(chipPosition.nine);
                setDealerPositionArray(dealerPosition.nine);
                break;
            default:
                setPlayerPositionArray([]);
                setChipPositionArray([]);
                setDealerPositionArray([]);
        }
    }, [tableSize]);

    const onCloseSideBar = () => {
        setOpenSidebar(!openSidebar);
    };

    const onGoToDashboard = () => {
        navigate("/");
    };

    // Add this helper function for copying to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here if you want
    };

    // Add this function to check if the game is still in progress
    const isGameInProgress = () => {
        const activePlayers = tableData?.data?.players?.filter((p: any) => p.status !== "folded" && p.status !== "sitting-out");
        return activePlayers && activePlayers.length > 1;
    };

    // Add this check early in your component
    if (tableDataValues.isLoading) {
        return <div className="h-screen flex items-center justify-center text-white">Loading table data...</div>;
    }

    if (tableDataValues.error) {
        return <div className="h-screen flex items-center justify-center text-white">Error: {tableDataValues.error.message}</div>;
    }

    if (!tableDataValues.tableDataPlayers || !tableDataValues.tableDataCommunityCards) {
        return <div className="h-screen flex items-center justify-center text-white">Waiting for table data...</div>;
    }

    return (
        <div className="relative h-screen w-full overflow-hidden">
            {/* Add the keyframe animation */}
            <style>{`
                @keyframes gradient {
                    0% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                    100% {
                        background-position: 0% 50%;
                    }
                }
            `}</style>

            {/*//! HEADER - CASINO STYLE */}
            <div className="flex-shrink-0">
                <div className="w-[100vw] h-[65px] bg-custom-mong from-[#1a2639] via-[#2a3f5f] to-[#1a2639] text-center flex items-center justify-between px-4 z-10 relative overflow-hidden border-b-2 border-[#3a546d]">
                    {/* Subtle animated background */}
                    <div className="absolute inset-0 z-0">
                        {/* Bottom edge glow */}
                        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-custom-mong from-transparent via-[#64ffda] to-transparent opacity-50"></div>
                    </div>

                    {/* Left Section - Lobby button */}
                    <div className="flex items-center space-x-3 z-10">
                        <div className="flex items-center justify-center w-10 h-10 bg-custom-mong from-[#2c3e50] to-[#1e293b] rounded-full shadow-md border border-[#3a546d] hover:border-[#64ffda] transition-all duration-300" onClick={() => navigate("/")}>
                            <IoMenuSharp size={20} className="text-[#64ffda]" />
                        </div>
                        <span className="text-white font-medium text-[20px] cursor-pointer hover:text-[#64ffda] transition-colors duration-300" onClick={() => navigate("/")}>
                            Lobby
                        </span>
                    </div>

                    {/* Middle Section - Table info */}
                    <div className="flex flex-col items-center text-white z-10">
                        <div className="bg-[#0f172a80] px-4 py-1 rounded-lg border border-[#3a546d] shadow-inner">
                            <span className="text-[#64ffda] mr-2 text-sm">♠️</span>
                            <span>Table: {id}</span>
                            <span className="text-[#64ffda] mx-2 text-sm">♦️</span>
                            {/* <span>{tableData && tableData.data?.type}</span> */}
                        </div>
                    </div>

                    {/* Right Section - Wallet info */}
                    <div className="flex items-center z-10">
                        <div className="flex flex-col items-end justify-center text-white mr-3">
                            {walletLoading ? (
                                <span>Loading...</span>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1 text-gray-300">
                                        <span className="opacity-75 text-[11px]">Account:</span>
                                        <span className="font-mono text-[10px] text-[#64ffda]">
                                            {`${localStorage.getItem("user_eth_public_key")?.slice(0, 6)}...${localStorage.getItem("user_eth_public_key")?.slice(-4)}`}
                                        </span>
                                        <FaCopy
                                            className="ml-1 cursor-pointer text-gray-400 hover:text-[#64ffda] transition-colors duration-200"
                                            size={12}
                                            onClick={() => copyToClipboard(localStorage.getItem("user_eth_public_key") || "")}
                                            title="Copy full address"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className="opacity-75 text-[11px]">Balance:</span>
                                        <span className="font-medium text-[#64ffda] text-[12px]">
                                            ${balance ? formatWeiToUSD(balance) : "0.00"}
                                            <span className="text-[10px] ml-1 text-gray-400">USDC</span>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center justify-center w-10 h-10 cursor-pointer bg-custom-mong from-[#2c3e50] to-[#1e293b] rounded-full shadow-md border border-[#3a546d] hover:border-[#64ffda] transition-all duration-300">
                            <RiMoneyDollarCircleLine
                                className="text-[#64ffda] hover:scale-110 transition-transform duration-200"
                                size={22}
                                onClick={() => navigate("/deposit")}
                            />
                        </div>
                    </div>
                </div>

                {/* SUB HEADER */}
                <div className="bg-custom-mong text-white flex justify-between items-center p-2 h-[35px] relative overflow-hidden shadow-lg">
                    {/* Animated background overlay */}
                    <div
                        className="bg-custom-mong absolute inset-0 z-0"
                    />

                    {/* Add the keyframe animation */}
                    <style>{`
                        @keyframes shimmer {
                            0% { background-position: 0% 0; }
                            100% { background-position: 200% 0; }
                        }
                    `}</style>

                    {/* Left Section */}
                    <div className="flex items-center z-10">
                        <span className="px-2 py-1 rounded bg-gradient-to-r from-green-900 to-green-800 shadow-inner text-[12px] border border-green-700">
                            ${tableDataValues.tableDataSmallBlind}/${tableDataValues.tableDataBigBlind}
                        </span>
                        <span className="ml-2 text-[12px]">
                            Game Type: <span className="font-semibold text-[13px] text-yellow-400">{tableDataValues.tableDataType}</span>
                        </span>
                    </div>

                    {/* Right Section */}
                    <div className="flex items-center z-10">
                        <span className="text-sm cursor-pointer hover:text-green-400 transition-colors duration-200" onClick={onCloseSideBar}>
                            {openSidebar ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
                        </span>
                        <button
                            className="ml-2 px-3 py-1 rounded-md bg-gradient-to-r from-red-800 to-red-700 hover:from-red-700 hover:to-red-600 
                            text-white font-medium text-xs shadow-md border border-red-900 hover:border-red-800 
                            transition-all duration-200 flex items-center justify-center transform hover:scale-105"
                            onClick={onGoToDashboard}
                            title="Return to Lobby"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Exit
                        </button>
                    </div>
                </div>
            </div>

            {/*//! BODY */}
            <div className="flex w-full flex-grow overflow-hidden">
                {/*//! TABLE + FOOTER */}
                <div
                    className={`flex-grow flex flex-col justify-between transition-all duration-250 overflow-hidden`}
                    style={{
                        transition: "margin 0.3s ease"
                    }}
                >
                    {/*//! TABLE */}
                    <div className="flex-grow flex flex-col align-center justify-center min-h-[calc(100vh-350px)] z-[0] relative">
                        {/* Animated background overlay */}


                        {/* Animated overlay */}


                        {/* Base gradient background */}
                        <div
                            className="absolute inset-0 z-0 bg-custom-mong"
                            
                        />

                        <div className="zoom-wrapper"
                            style={{
                                position: "absolute",
                                top: "50%",
                                left: "50%",
                                transform: `translate(-50%, -50%) scale(${zoom})`,
                                transformOrigin: "center center",
                                width: "1600px",
                                height: "850px",
                                maxWidth: "100vw",
                                maxHeight: "calc(100vh - 180px)", // leave room for header/footer
                                overflow: "visible", // ensure nothing is cut off
                            }}>
                            <div className="flex-grow scrollbar-none bg-custom-mong h-full flex flex-col justify-center items-center relative">
                                <div className="w-[900px] h-[450px] relative text-center block transform translate-y-[30px]">
                                    <div className="h-full flex align-center justify-center">
                                        <div className="z-20 relative flex flex-col w-[900px] h-[350px] left-1/2 top-5 transform -translate-x-1/2 text-center border-[3px] border-rgba(255, 255, 255, 0.2) border-solid rounded-full items-center justify-center shadow-[0_7px_15px_rgba(0,0,0,0.6)]">
                                            {/* //! Table */}
                                            <div className="px-4 h-[25px] rounded-full bg-[#00000054] flex align-center justify-center">
                                                <span className="text-[#dbd3d3] mr-2">
                                                    Total Pot:{" "}
                                                    {tableDataValues.tableDataPots?.[0] === "0"
                                                        ? "0.00"
                                                        : tableDataValues.tableDataPots
                                                            ?.reduce((sum: number, pot: string) => sum + Number(ethers.formatUnits(pot, 18)), 0)
                                                            .toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="px-4 h-[21px] rounded-full bg-[#00000054] flex align-center justify-center mt-2">
                                                <span className="text-[#dbd3d3] mr-2">
                                                    Main Pot:{" "}
                                                    {tableDataValues.tableDataPots?.[0] === "0"
                                                        ? "0.00"
                                                        : Number(ethers.formatUnits(tableDataValues.tableDataPots?.[0] || "0", 18)).toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 mt-8">
                                                {tableDataValues.tableDataRound === "preflop"
                                                    ? // Show face-down cards in preflop
                                                    Array(5)
                                                        .fill(null)
                                                        .map((_, index) => (
                                                            <div
                                                                key={index}
                                                                className="w-[85px] h-[127px] aspect-square border-[0.5px] border-dashed border-white rounded-[5px]"
                                                            />
                                                        ))
                                                    : // Show actual cards for other rounds
                                                    (tableDataValues.tableDataCommunityCards || []).map((card: any, index: number) => (
                                                        <div key={index} className="card animate-fall">
                                                            <OppositePlayerCards frontSrc={`/cards/${card}.svg`} backSrc="/cards/Back.svg" flipped={true} />
                                                        </div>
                                                    ))}
                                            </div>
                                            {/*//! CHIP */}
                                            {/* {chipPositionArray.map((position, index) => (
                                                <div
                                                    key={`key-${index}`}
                                                    style={{
                                                        left: position.left,
                                                        bottom: position.bottom
                                                    }}
                                                    className="absolute"
                                                >
                                                    <Chip amount={Number(tableDataValues.tableDataPots[index])} />
                                                </div>
                                            ))} */}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 z-30">
                                        {playerPositionArray.map((position, positionIndex) => {
                                            // Find the player at this seat position
                                            const playerAtThisSeat = activePlayers.find((p: any) => p.seat === positionIndex);

                                            // Check if this player is the current user
                                            const isCurrentUser = playerAtThisSeat && playerAtThisSeat.address?.toLowerCase() === userWalletAddress;

                                            // More detailed logging only in DEBUG_MODE
                                            if (DEBUG_MODE && playerAtThisSeat) {
                                                debugLog(`Seat ${positionIndex} detailed comparison:`, {
                                                    playerAddress: playerAtThisSeat.address,
                                                    playerAddressLower: playerAtThisSeat.address?.toLowerCase(),
                                                    currentUserAddress: userWalletAddress,
                                                    currentUserAddressLower: userWalletAddress?.toLowerCase(),
                                                    isMatch: isCurrentUser,
                                                    exactCompare: playerAtThisSeat.address === userWalletAddress,
                                                    lowerCompare: playerAtThisSeat.address?.toLowerCase() === userWalletAddress?.toLowerCase()
                                                });
                                            }

                                            const componentProps = {
                                                index: positionIndex,
                                                currentIndex: currentIndex,
                                                left: position.left,
                                                top: position.top,
                                                color: position.color,
                                                status: tableDataValues.tableDataPlayers?.[positionIndex]?.status
                                            };

                                            const componentToRender = !playerAtThisSeat ? (
                                                // No player at this seat - show vacant player
                                                <VacantPlayer index={positionIndex} left={position.left} top={position.top} />
                                            ) : isCurrentUser ? (
                                                // This is the current user's position - use Player component
                                                <Player
                                                    {...componentProps}
                                                />
                                            ) : (
                                                // This is another player's position - use OppositePlayer component
                                                <OppositePlayer
                                                    {...componentProps}
                                                    setStartIndex={(index: number) => setStartIndex(index)}
                                                    isCardVisible={isCardVisible}
                                                    setCardVisible={setCardVisible}
                                                />
                                            );

                                            if (DEBUG_MODE) {
                                                debugLog(`Rendering component for seat ${positionIndex}:`, {
                                                    isVacant: !playerAtThisSeat,
                                                    isCurrentUser,
                                                    componentType: !playerAtThisSeat ? "VacantPlayer" : isCurrentUser ? "Player" : "OppositePlayer",
                                                    currentUserAddress: userWalletAddress
                                                });
                                            }

                                            return (
                                                <div key={positionIndex} className="z-[10]">
                                                    {componentToRender}
                                                    <div>
                                                        <TurnAnimation left={position.left} top={position.top} index={positionIndex} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/*//! Dealer */}
                                    {isDealerButtonVisible && (
                                        <div
                                            className="absolute z-50 bg-white text-black font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-black"
                                            style={{
                                                left: `calc(${dealerButtonPosition.left} + 200px)`,
                                                top: dealerButtonPosition.top,
                                                transform: "none"
                                            }}
                                        >
                                            D
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end mr-3 mb-1">
                            {userData && <span className="text-white bg-[#0c0c0c80] rounded-full px-2">{userData.hand_strength}</span>}
                        </div>
                    </div>

                    {/*//! FOOTER */}
                    <div className="flex-shrink-0 w-full h-[190px] bg-custom-mong text-center z-[10] flex justify-center">
                        <PokerActionPanel />
                    </div>
                </div>
                {/*//! SIDEBAR */}
                <div
                    className={`fixed top-[0px] right-0 h-full bg-custom-mong overflow-hidden transition-all duration-300 ease-in-out relative ${openSidebar ? "w-[300px]" : "w-0"
                        }`}
                    style={{
                        boxShadow: openSidebar ? "0px 0px 10px rgba(0,0,0,0.5)" : "none"
                    }}
                >
                    <div className={`transition-opacity duration-300 ${openSidebar ? "opacity-100" : "opacity-0"} absolute left-0 top-0`}>
                        <PokerLog />
                    </div>
                </div>
            </div>

            {/* Add a message for empty table if needed */}
            {activePlayers.length === 0 && (
                <div className="absolute top-24 right-4 text-white bg-black bg-opacity-50 p-4 rounded">Waiting for players to join...</div>
            )}
            {/* Add a message for the current user's seat */}
            {currentUserSeat >= 0 && (
                <div className="absolute top-24 left-4 text-white bg-black bg-opacity-50 p-2 rounded">You are seated at position {currentUserSeat + 1}</div>
            )}
            {/* Add an indicator for whose turn it is */}
            {nextToActInfo && isGameInProgress() && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 p-2 rounded">
                    {nextToActInfo.isCurrentUserTurn && playerLegalActions && playerLegalActions.length > 0 ? (
                        <span className="text-green-400 font-bold">Your turn to act!</span>
                    ) : (
                        <span>
                            Waiting for{" "}
                            {nextToActInfo.seat === 1 ? "Small Blind" : nextToActInfo.seat === 2 ? "Big Blind" : `player at position ${nextToActInfo.seat + 1}`}{" "}
                            to act
                        </span>
                    )}
                </div>
            )}
            {/* Show a message when the hand is over */}
            {tableData?.data?.players && !isGameInProgress() && activePlayers.length > 0 && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-70 p-2 rounded">
                    <span>Hand complete - waiting for next hand</span>
                </div>
            )}
        </div>
    );
};

export default Table;
