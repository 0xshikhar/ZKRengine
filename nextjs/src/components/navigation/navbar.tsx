"use client"
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ModeToggle } from "@/components/mode-toggle";
import { siteConfig } from "@/config/site";
import { Sparkles } from "lucide-react";

const Navbar = () => {
	return (
		<nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-16 items-center">
				{/* Logo */}
				<Link href="/" className="flex items-center space-x-2">
					<Sparkles className="h-6 w-6 text-primary" />
					<span className="font-bold text-xl">{siteConfig.name}</span>
				</Link>

				{/* Desktop Navigation */}
				<div className="hidden md:flex flex-1 items-center justify-center space-x-6 text-sm font-medium">
					<Link href="/" className="transition-colors hover:text-foreground/80">
						Home
					</Link>
					<Link href="#features" className="transition-colors hover:text-foreground/80">
						Features
					</Link>
					<Link href="#docs" className="transition-colors hover:text-foreground/80">
						Documentation
					</Link>
					<Link href="#about" className="transition-colors hover:text-foreground/80">
						About
					</Link>
				</div>

				{/* Right side items */}
				<div className="flex items-center space-x-4">
					<ConnectButton />
					<ModeToggle />
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
