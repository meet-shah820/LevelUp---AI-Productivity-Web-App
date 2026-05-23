import { GraduationCap } from "lucide-react";
import { Button } from "../components/ui/button";
import { useTutorial } from "./TutorialContext";

export function TutorialHelpButton() {
	const { active, startTutorial } = useTutorial();

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="text-gray-400 hover:text-white"
			title={active ? "Tutorial in progress" : "Replay app tutorial (no required actions)"}
			aria-label={active ? "Tutorial in progress" : "Replay app tutorial"}
			disabled={active}
			onClick={() => startTutorial()}
		>
			<GraduationCap className="w-5 h-5" />
		</Button>
	);
}
