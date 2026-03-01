"use client";

import { useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    ListTodo,
    TrendingUp,
    Users as UsersIcon,
    Layers
} from "lucide-react";
import * as d3 from "d3";

interface Task {
    id: string;
    taskName: string;
    status: string;
    deadline?: string;
    actualAssigneeEmail?: string;
    phase?: string;
    targetWeek?: number;
}

interface Project {
    id: string;
    Project_Name: string;
}

interface DashboardClientPageProps {
    kpiData: {
        total: number;
        completed: number;
        pending: number;
        overdue: number;
    };
    initialTasks: Task[];
    projects: Project[];
}

export function DashboardClientPage({ kpiData, initialTasks, projects }: DashboardClientPageProps) {
    // 1. D3 Chart logic follows...
    const workloadData = useMemo(() => {
        const counts: Record<string, number> = {};
        initialTasks.forEach(t => {
            const email = t.actualAssigneeEmail || "Unassigned";
            counts[email] = (counts[email] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10 members
    }, [initialTasks]);

    const progressData = useMemo(() => {
        const counts: Record<number, number> = {};
        initialTasks.forEach(t => {
            if (t.targetWeek) {
                counts[t.targetWeek] = (counts[t.targetWeek] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .map(([week, value]) => ({ week: parseInt(week), value }))
            .sort((a, b) => a.week - b.week);
    }, [initialTasks]);

    const phaseData = useMemo(() => {
        const phases: Record<string, { total: number; done: number }> = {};
        initialTasks.forEach(t => {
            const p = t.phase || "Other";
            if (!phases[p]) phases[p] = { total: 0, done: 0 };
            phases[p].total++;
            if (t.status === "completed") phases[p].done++;
        });
        return Object.entries(phases).map(([name, stats]) => ({
            name,
            percentage: Math.round((stats.done / stats.total) * 100),
            total: stats.total
        }));
    }, [initialTasks]);

    // 3. D3 Charts Refs & Effects
    const workloadRef = useRef<SVGSVGElement>(null);
    const progressRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!workloadRef.current || workloadData.length === 0) return;

        const svg = d3.select(workloadRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 20, right: 20, bottom: 60, left: 40 };
        const width = workloadRef.current.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .rangeRound([0, width])
            .padding(0.3)
            .domain(workloadData.map(d => d.label));

        const y = d3.scaleLinear()
            .rangeRound([height, 0])
            .domain([0, d3.max(workloadData, d => d.value) || 0]);

        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-30)")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em");

        g.append("g")
            .call(d3.axisLeft(y).ticks(5));

        g.selectAll(".bar")
            .data(workloadData)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.label) || 0)
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.value))
            .attr("fill", "#6366f1")
            .attr("rx", 4);
    }, [workloadData]);

    useEffect(() => {
        if (!progressRef.current || progressData.length === 0) return;

        const svg = d3.select(progressRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = progressRef.current.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .range([0, width])
            .domain([d3.min(progressData, d => d.week) || 1, d3.max(progressData, d => d.week) || 20]);

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(progressData, d => d.value) || 0]);

        const line = d3.line<{ week: number; value: number }>()
            .x(d => x(d.week))
            .y(d => y(d.value))
            .curve(d3.curveMonotoneX);

        g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d => `W${d}`));

        g.append("g")
            .call(d3.axisLeft(y).ticks(5));

        g.append("path")
            .datum(progressData)
            .attr("fill", "none")
            .attr("stroke", "#10b981")
            .attr("stroke-width", 3)
            .attr("d", line);

        g.selectAll(".dot")
            .data(progressData)
            .enter().append("circle")
            .attr("cx", d => x(d.week))
            .attr("cy", d => y(d.value))
            .attr("r", 4)
            .attr("fill", "#10b981");
    }, [progressData]);

    return (
        <div className="space-y-4 -mt-4 pb-12">
            {/* 1. Summary Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Total Tasks" value={kpiData.total} icon={<ListTodo className="h-4 w-4 text-slate-500" />} />
                <SummaryCard title="Completed" value={kpiData.completed} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
                <SummaryCard title="Pending" value={kpiData.pending} icon={<Clock className="h-4 w-4 text-amber-500" />} />
                <SummaryCard title="Overdue" value={kpiData.overdue} icon={<AlertCircle className="h-4 w-4 text-red-500" />} />
            </div>

            {/* 2. Charts Row */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="py-0 gap-0">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <UsersIcon className="h-4 w-4" /> Team Workload
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-2 pb-6">
                        {workloadData.length > 0 ? (
                            <svg ref={workloadRef} className="w-full h-[300px]" />
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-slate-400 italic">
                                No workload data available
                            </div>
                        )}
                    </CardContent>
                </Card>
                <Card className="py-0 gap-0">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Weekly Task Volume
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-2 pb-6">
                        {progressData.length > 0 ? (
                            <svg ref={progressRef} className="w-full h-[300px]" />
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-slate-400 italic">
                                No progress data available
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 3. Phase Breakdown */}
            <Card className="py-0 gap-0">
                <CardHeader className="p-6 pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Layers className="h-4 w-4" /> Phase Completion Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {phaseData.map(phase => (
                            <div key={phase.name} className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="font-medium">{phase.name}</span>
                                    <span className="text-slate-500">{phase.percentage}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${phase.percentage}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                                    {phase.total} tasks total
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// --- Summary Card ---
function SummaryCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
    return (
        <Card className="shadow-sm border-slate-200 bg-white dark:bg-slate-900/50 h-[72px] py-0 gap-0">
            <CardContent className="p-4 py-2 flex flex-col justify-center h-full">
                <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</span>
                        <div className="opacity-70">
                            {icon}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
