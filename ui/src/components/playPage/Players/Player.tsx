import * as React from "react";
import Badge from "../common/Badge";
import ProgressBar from "../common/ProgressBar";
import { PlayerStatus } from "@bitcoinbrisbane/block52";
import { ethers } from "ethers";
import { useTableContext } from "../../../context/TableContext";

// Enable this to see verbose logging
const DEBUG_MODE = false;

// Helper function that only logs when DEBUG_MODE is true
const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

type PlayerProps = {
    left?: string;
    top?: string;
    index: number;
    currentIndex: number;
    color?: string;
    status?: string;
};

const Player: React.FC<PlayerProps> = ({ left, top, index, color, status }) => {
    const { tableData } = useTableContext();

    const [avatar, setAvatar] = React.useState<string | null>(null);

    React.useEffect(() => {
        const savedNFT = localStorage.getItem("selectedNFT");
        if (savedNFT) {
            setAvatar(savedNFT);
        }
    }, []);

    const playerData = React.useMemo(() => {
        if (!tableData?.data?.players) return null;
        return tableData.data.players.find((p: any) => p.seat === index);
    }, [tableData, index]);

    if (!playerData) {
        debugLog("Player component has no player data for seat", index);
        return <></>;
    }

    const stackValue = playerData.stack ? Number(ethers.formatUnits(playerData.stack, 18)) : 0;
    const holeCards = playerData.holeCards;

    return (
        <div
            key={index}
            className={`${
                playerData.status === PlayerStatus.FOLDED ? "opacity-60" : ""
            } absolute flex flex-col justify-center text-gray-600 w-[150px] h-[140px] mt-[40px] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer`}
            style={{
                left: left,
                top: top,
                transition: "top 1s ease, left 1s ease"
            }}
        >
            {/* Avatar on the left of the cards */}
            {avatar && (
                <div className="absolute left-[-35px] top-[20px]">
                    <img
                        src={avatar}
                        alt="Player Avatar"
                        className="w-10 h-10 rounded-full border-2 border-white shadow-md"
                    />
                </div>
            )}

            <div className="flex justify-center gap-1">
                {holeCards && holeCards.length === 2 ? (
                    <>
                        <img src={`/cards/${holeCards[0]}.svg`} width={60} height={80} />
                        <img src={`/cards/${holeCards[1]}.svg`} width={60} height={80} />
                    </>
                ) : (
                    <div className="w-[120px] h-[80px]"></div>
                )}
            </div>

            <div className="relative flex flex-col justify-end mt-[-6px] mx-1s">
                <div
                    style={{ backgroundColor: "green" }}
                    className="b-[0%] mt-[auto] w-full h-[55px] shadow-[1px_2px_6px_2px_rgba(0,0,0,0.3)] rounded-tl-2xl rounded-tr-2xl rounded-bl-md rounded-br-md flex flex-col"
                >
                    <ProgressBar index={index} />
                    {playerData.status === PlayerStatus.FOLDED && (
                        <span className="text-white animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center">
                            FOLD
                        </span>
                    )}
                    {playerData.status === PlayerStatus.ALL_IN && (
                        <span className="text-white animate-progress delay-2000 flex items-center w-full h-2 mb-2 mt-auto gap-2 justify-center">
                            All In
                        </span>
                    )}
                </div>
                <div className="absolute top-[0%] w-full">
                    <Badge count={index} value={stackValue} color={color} />
                </div>
            </div>
        </div>
    );
};

export default Player;
