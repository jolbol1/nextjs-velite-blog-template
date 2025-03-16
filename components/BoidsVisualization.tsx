"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BoidsVisualizationProps {
  className?: string;
  width?: number;
  height?: number;
  numBoids?: number;
  backgroundColor?: string;
  boidColor?: string;
  boidRadius?: number;
  depth?: number; // New prop for depth of the 3D space
  shapeComplexity?: number; // New prop for shape complexity
  shapeWeight?: number; // Weight of shape-forming behavior
  shapeType?: "circle" | "figure8" | "spiral" | "heart" | "random" | "dynamic" | "warp" | "splines"; // Shape pattern to form
  numDynamicAttractors?: number; // Number of dynamic attractors for the "dynamic" shape type
  attractorChangeInterval?: number; // How often (in ms) dynamic attractors change positions
  maxSpeed?: number; // Maximum speed boids can travel
  showTrails?: boolean; // Whether to show motion trails
  trailOpacity?: number; // Opacity of the motion trails (0-1)
  warpSpeed?: number; // Speed of warping transformations
  splineChangeInterval?: number; // How often (in ms) to generate new splines
}

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

interface AttractorPoint {
  position: Vector3D;
  strength: number;
}

interface Boid {
  position: Vector3D;
  velocity: Vector3D;
  acceleration: Vector3D;
  id: number;
  targetAttractor?: number; // Index of the attractor point this boid is drawn to
}

interface Cell {
  boids: Boid[];
}

class SpatialGrid3D {
  cells: Map<string, Cell>;
  cellSize: number;

  constructor(cellSize: number) {
    this.cells = new Map();
    this.cellSize = cellSize;
  }

  // Get cell coordinates based on position
  getCellCoords(x: number, y: number, z: number): { row: number; col: number; depth: number } {
    const row = Math.floor(y / this.cellSize);
    const col = Math.floor(x / this.cellSize);
    const depth = Math.floor(z / this.cellSize);
    return { row, col, depth };
  }

  // Get cell key from coordinates
  getCellKey(row: number, col: number, depth: number): string {
    return `${row},${col},${depth}`;
  }

  // Clear all cells
  clear(): void {
    this.cells.clear();
  }

  // Add a boid to the appropriate cell
  addBoid(boid: Boid): void {
    const { row, col, depth } = this.getCellCoords(
      boid.position.x, 
      boid.position.y, 
      boid.position.z
    );
    const key = this.getCellKey(row, col, depth);

    if (!this.cells.has(key)) {
      this.cells.set(key, { boids: [] });
    }

    this.cells.get(key)!.boids.push(boid);
  }

  // Get all neighbor boids within a certain radius
  getNeighbors(boid: Boid, radius: number): Boid[] {
    const { row, col, depth } = this.getCellCoords(
      boid.position.x, 
      boid.position.y, 
      boid.position.z
    );
    const radiusCells = Math.ceil(radius / this.cellSize);
    const neighbors: Boid[] = [];

    // Check cells in a cube around the current cell
    for (let r = row - radiusCells; r <= row + radiusCells; r++) {
      for (let c = col - radiusCells; c <= col + radiusCells; c++) {
        for (let d = depth - radiusCells; d <= depth + radiusCells; d++) {
          const key = this.getCellKey(r, c, d);
          const cell = this.cells.get(key);

          if (cell) {
            for (const neighbor of cell.boids) {
              if (neighbor.id !== boid.id) {
                // Calculate actual distance to ensure it's within radius
                const dx = neighbor.position.x - boid.position.x;
                const dy = neighbor.position.y - boid.position.y;
                const dz = neighbor.position.z - boid.position.z;
                const distSquared = dx * dx + dy * dy + dz * dz;

                if (distSquared < radius * radius) {
                  neighbors.push(neighbor);
                }
              }
            }
          }
        }
      }
    }

    return neighbors;
  }
}

export default function BoidsVisualization({
  className,
  width = 600,
  height = 400,
  numBoids = 10000,
  backgroundColor = "#0f1729",
  boidColor = "#ffffff",
  boidRadius = 2,
  depth = 400, // Default depth matches height
  shapeComplexity = 12, // Number of attraction points for shape formation
  shapeWeight = 1.2, // Weight of shape-forming behavior
  shapeType = "dynamic", // Default to dynamic shape pattern 
  numDynamicAttractors = 4, // Default number of dynamic attractors
  attractorChangeInterval = 3000, // Change attractors every 3 seconds by default
  maxSpeed, // Maximum speed boids can travel
  showTrails = true, // Enable trails by default
  trailOpacity = 0.5, // Default trail opacity
  warpSpeed = 1.0, // Default warp transformation speed
  splineChangeInterval = 5000, // Generate new splines every 5 seconds by default
}: BoidsVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const boidsRef = useRef<Boid[]>([]);
  const gridRef = useRef<SpatialGrid3D | null>(null);
  const attractorsRef = useRef<AttractorPoint[]>([]);
  const timeRef = useRef<number>(0);
  const lastAttractorChangeRef = useRef<number>(0);
  
  // Set of target positions for smooth transitions
  const targetAttractorsRef = useRef<AttractorPoint[]>([]);
  const transitionProgressRef = useRef<number>(0);

  const lastSplineChangeRef = useRef<number>(0);
  const splinePointsRef = useRef<AttractorPoint[]>([]);

  // Create dynamic attractors with random positions
  const createDynamicAttractors = () => {
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZ = depth / 2;
    
    // Store previous attractors for smooth transition
    const oldAttractors = [...attractorsRef.current];
    
    // Create new target attractor positions
    const newAttractors: AttractorPoint[] = [];
    const numAttractors = shapeType === "dynamic" ? numDynamicAttractors : shapeComplexity;
    
    for (let i = 0; i < numAttractors; i++) {
      // Create positions with some bias toward the center to avoid edges
      const randomX = centerX + (Math.random() * 2 - 1) * width * 0.7;
      const randomY = centerY + (Math.random() * 2 - 1) * height * 0.7;
      const randomZ = centerZ + (Math.random() * 2 - 1) * depth * 0.7;
      
      newAttractors.push({
        position: {
          x: randomX,
          y: randomY,
          z: randomZ
        },
        strength: 0.8 + Math.random() * 0.4 // Random strength between 0.8 and 1.2
      });
    }
    
    // Set the targets for smooth transition
    targetAttractorsRef.current = newAttractors;
    
    // If it's the first initialization, immediately set the attractors
    if (oldAttractors.length === 0) {
      attractorsRef.current = newAttractors;
      
      // Randomly assign boids to attractors
      const boids = boidsRef.current;
      for (let i = 0; i < boids.length; i++) {
        boids[i].targetAttractor = Math.floor(Math.random() * newAttractors.length);
      }
    } else {
      // Otherwise start a transition
      transitionProgressRef.current = 0;
    }
    
    // Reset the timer
    lastAttractorChangeRef.current = Date.now();
  };

  // Generate random organic splines that form ellipsoid-like shapes
  const generateOrganicSplines = () => {
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZ = depth / 2;
    
    // Set of new attractor points that will form our spline
    const splinePoints: AttractorPoint[] = [];
    
    // Randomly determine the major characteristics of this ellipsoid/spline
    // We'll use multiple techniques to generate different types of organic forms
    const splineType = Math.floor(Math.random() * 4); // 0-3 different spline generation methods
    
    // Size range - between 30% and 70% of the container size
    const maxSize = Math.min(width, height) * (0.3 + Math.random() * 0.4);
    
    // How many points to use for this spline
    const pointCount = shapeComplexity * 2; // Double the normal complexity for smoother splines
    
    // Random rotation angles for 3D orientation
    const rotX = Math.random() * Math.PI * 2;
    const rotY = Math.random() * Math.PI * 2;
    const rotZ = Math.random() * Math.PI * 2;
    
    // Random scaling factors to create different ellipsoid forms
    const scaleX = 0.5 + Math.random() * 1.0;
    const scaleY = 0.5 + Math.random() * 1.0;
    const scaleZ = 0.5 + Math.random() * 1.0;
    
    // Random displacement from center
    const offsetX = (Math.random() * 2 - 1) * width * 0.15;
    const offsetY = (Math.random() * 2 - 1) * height * 0.15;
    const offsetZ = (Math.random() * 2 - 1) * depth * 0.15;
    
    // Generate points based on the randomly selected spline type
    switch (splineType) {
      case 0: // Ellipsoid
        for (let i = 0; i < pointCount; i++) {
          const theta = (i / pointCount) * Math.PI * 2; // Around the main circle
          const phi = (Math.random() * 0.8 + 0.1) * Math.PI; // Up/down variation
          
          // Apply some noise to make it more organic
          const noise = 0.8 + Math.random() * 0.4;
          
          // Base ellipsoid coordinates
          let x = Math.sin(phi) * Math.cos(theta) * maxSize * scaleX * noise;
          let y = Math.sin(phi) * Math.sin(theta) * maxSize * scaleY * noise;
          let z = Math.cos(phi) * maxSize * scaleZ * noise;
          
          // Apply 3D rotation (simplified rotation matrix)
          const x1 = x;
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          
          const x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
          const y2 = y1;
          const z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);
          
          const x3 = x2 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
          const z3 = z2;
          
          // Add to spline points with offset from center
          splinePoints.push({
            position: {
              x: centerX + x3 + offsetX,
              y: centerY + y3 + offsetY,
              z: centerZ + z3 + offsetZ
            },
            strength: 0.8 + Math.random() * 0.4
          });
        }
        break;
        
      case 1: // Ribbon/Möbius-like form
        for (let i = 0; i < pointCount; i++) {
          const t = (i / pointCount) * Math.PI * 2;
          const width = maxSize * 0.1 * (1 + Math.sin(t * 3) * 0.5); // Variable width
          
          // Base ribbon coordinates with a twist
          let x = Math.sin(t) * maxSize * scaleX;
          let y = Math.cos(t) * maxSize * scaleY;
          let z = Math.sin(t * 2) * width * scaleZ;
          
          // Apply noise for organic feel
          x += (Math.random() * 2 - 1) * maxSize * 0.05;
          y += (Math.random() * 2 - 1) * maxSize * 0.05;
          z += (Math.random() * 2 - 1) * maxSize * 0.05;
          
          // Apply 3D rotation
          const x1 = x;
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          
          const x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
          const y2 = y1;
          const z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);
          
          const x3 = x2 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
          const z3 = z2;
          
          splinePoints.push({
            position: {
              x: centerX + x3 + offsetX,
              y: centerY + y3 + offsetY,
              z: centerZ + z3 + offsetZ
            },
            strength: 0.9 + Math.random() * 0.2
          });
        }
        break;
        
      case 2: // Lemniscate (figure 8) with variations
        for (let i = 0; i < pointCount; i++) {
          const t = (i / pointCount) * Math.PI * 2;
          const a = maxSize * scaleX;
          const b = maxSize * scaleY;
          
          // Generalized lemniscate form with variation
          const denom = 1 + Math.sin(t) * Math.sin(t);
          let x = (a * Math.cos(t)) / denom;
          let y = (b * Math.sin(t) * Math.cos(t)) / denom;
          let z = (Math.sin(t * 3) * maxSize * 0.15 * scaleZ);
          
          // Apply noise
          x += (Math.random() * 2 - 1) * maxSize * 0.08;
          y += (Math.random() * 2 - 1) * maxSize * 0.08;
          z += (Math.random() * 2 - 1) * maxSize * 0.08;
          
          // Apply 3D rotation
          const x1 = x;
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          
          const x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
          const y2 = y1;
          const z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);
          
          const x3 = x2 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
          const z3 = z2;
          
          splinePoints.push({
            position: {
              x: centerX + x3 + offsetX,
              y: centerY + y3 + offsetY,
              z: centerZ + z3 + offsetZ
            },
            strength: 0.85 + Math.random() * 0.3
          });
        }
        break;
        
      case 3: // Toroidal spiral
      default:
        // Parameters for the spiral
        const torusRadius = maxSize * 0.5 * scaleX;
        const tubeRadius = maxSize * 0.2 * scaleY;
        const spiralTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
        
        for (let i = 0; i < pointCount; i++) {
          const t = (i / pointCount) * Math.PI * 2 * spiralTurns;
          const angle1 = t;
          const angle2 = (i / pointCount) * Math.PI * 2;
          
          // Base torus with spiral coordinates
          let x = (torusRadius + tubeRadius * Math.cos(angle2)) * Math.cos(angle1);
          let y = (torusRadius + tubeRadius * Math.cos(angle2)) * Math.sin(angle1);
          let z = tubeRadius * Math.sin(angle2) * scaleZ;
          
          // Apply noise
          x += (Math.random() * 2 - 1) * maxSize * 0.05;
          y += (Math.random() * 2 - 1) * maxSize * 0.05;
          z += (Math.random() * 2 - 1) * maxSize * 0.05;
          
          // Apply 3D rotation
          const x1 = x;
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          
          const x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
          const y2 = y1;
          const z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);
          
          const x3 = x2 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y2 * Math.cos(rotZ);
          const z3 = z2;
          
          splinePoints.push({
            position: {
              x: centerX + x3 + offsetX,
              y: centerY + y3 + offsetY,
              z: centerZ + z3 + offsetZ
            },
            strength: 0.8 + Math.random() * 0.4
          });
        }
        break;
    }
    
    // Update the spline points reference
    splinePointsRef.current = splinePoints;
    
    // Assign each boid to a point on the spline
    // We'll distribute them somewhat evenly for better coverage
    const boids = boidsRef.current;
    for (let i = 0; i < boids.length; i++) {
      // Distribute boids among spline points, with some randomization
      const pointIndex = Math.floor((i / boids.length) * splinePoints.length);
      boids[i].targetAttractor = pointIndex % splinePoints.length;
    }
    
    // Reset timer
    lastSplineChangeRef.current = Date.now();
  };

  // Create shape attractor points
  const createShapeAttractors = () => {
    const attractors: AttractorPoint[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZ = depth / 2;
    
    // Size of the shape relative to the container
    const shapeSize = Math.min(width, height) * 0.4;
    
    // Create attractor points in the desired shape
    switch (shapeType) {
      case "splines":
        // Initialize with the first set of spline points
        generateOrganicSplines();
        return; // Early return as we've already created the attractors
      
      case "warp":
        // Create a warping elliptical/toroidal/helical pattern
        // This will be dynamically updated in updateAttractors
        for (let i = 0; i < shapeComplexity; i++) {
          // Initial position - will be constantly morphed in updateAttractors
          const angle = (i / shapeComplexity) * Math.PI * 2;
          // Initial torus layout
          const torusRadius = shapeSize * 0.6;
          const tubeRadius = shapeSize * 0.3;
          
          attractors.push({
            position: {
              x: centerX + (torusRadius + tubeRadius * Math.cos(angle)) * Math.cos(angle * 2),
              y: centerY + (torusRadius + tubeRadius * Math.cos(angle)) * Math.sin(angle * 2),
              z: centerZ + tubeRadius * Math.sin(angle),
            },
            strength: 0.8 + Math.random() * 0.4
          });
        }
        break;
        
      case "dynamic":
        // Initialize with random positions, will be updated regularly
        createDynamicAttractors();
        return; // Early return as we've already created the attractors
        
      case "circle":
        // Create a circle of attraction points
        for (let i = 0; i < shapeComplexity; i++) {
          const angle = (i / shapeComplexity) * Math.PI * 2;
          attractors.push({
            position: {
              x: centerX + Math.cos(angle) * shapeSize,
              y: centerY + Math.sin(angle) * shapeSize,
              z: centerZ
            },
            strength: 1.0
          });
        }
        break;
        
      case "figure8":
        // Create a figure-8 pattern
        for (let i = 0; i < shapeComplexity; i++) {
          const t = (i / shapeComplexity) * Math.PI * 2;
          // Figure-8 parametric equation
          attractors.push({
            position: {
              x: centerX + Math.sin(t) * shapeSize * 0.5,
              y: centerY + Math.sin(t) * Math.cos(t) * shapeSize,
              z: centerZ + (Math.cos(t) - 1) * shapeSize * 0.2 // Add some 3D variation
            },
            strength: 1.0
          });
        }
        break;
        
      case "spiral":
        // Create a spiral pattern
        for (let i = 0; i < shapeComplexity; i++) {
          const angle = (i / shapeComplexity) * Math.PI * 6; // Multiple rotations
          const radius = (i / shapeComplexity) * shapeSize;
          attractors.push({
            position: {
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              z: centerZ + (i / shapeComplexity) * depth * 0.3 // Spiral upward in Z
            },
            strength: 1.0
          });
        }
        break;
        
      case "heart":
        // Create a heart shape
        for (let i = 0; i < shapeComplexity; i++) {
          const t = (i / shapeComplexity) * Math.PI * 2;
          // Heart shape parametric equation
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          attractors.push({
            position: {
              x: centerX + x * (shapeSize / 16),
              y: centerY - y * (shapeSize / 16), // Negative because y-axis is inverted
              z: centerZ + Math.sin(t * 2) * depth * 0.1 // Small z-variance
            },
            strength: 1.0
          });
        }
        break;
        
      case "random":
      default:
        // Create random attractors throughout the space (but fewer of them)
        const numRandomAttractors = Math.min(shapeComplexity, 6); // Limit to 6 max
        for (let i = 0; i < numRandomAttractors; i++) {
          attractors.push({
            position: {
              x: Math.random() * width * 0.8 + width * 0.1, // Keep away from edges
              y: Math.random() * height * 0.8 + height * 0.1,
              z: Math.random() * depth * 0.8 + depth * 0.1
            },
            strength: 0.5 + Math.random() * 0.5
          });
        }
        break;
    }
    
    attractorsRef.current = attractors;
    
    // Assign each boid to an attractor
    const boids = boidsRef.current;
    for (let i = 0; i < boids.length; i++) {
      boids[i].targetAttractor = i % attractors.length;
    }
  };

  // Update dynamic attractors - smooth transition between positions
  const updateDynamicAttractors = () => {
    if (shapeType !== "dynamic") return;
    
    // Check if it's time to change attractor positions
    const now = Date.now();
    if (now - lastAttractorChangeRef.current > attractorChangeInterval) {
      createDynamicAttractors();
    }
    
    // If we're in transition mode, interpolate between old and new positions
    if (transitionProgressRef.current < 1 && targetAttractorsRef.current.length > 0) {
      const current = attractorsRef.current;
      const targets = targetAttractorsRef.current;
      
      // Progress the transition
      transitionProgressRef.current += 0.02; // Adjust for faster/slower transitions
      const t = Math.min(transitionProgressRef.current, 1); // Clamp to 1
      
      // Use a smooth easing function (ease in-out)
      const smoothT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      // If attractors array isn't initialized yet, initialize it
      if (current.length === 0 && targets.length > 0) {
        attractorsRef.current = [...targets];
        transitionProgressRef.current = 1;
        return;
      }
      
      // Interpolate each attractor position
      for (let i = 0; i < Math.min(current.length, targets.length); i++) {
        current[i].position = {
          x: current[i].position.x + (targets[i].position.x - current[i].position.x) * smoothT * 0.1,
          y: current[i].position.y + (targets[i].position.y - current[i].position.y) * smoothT * 0.1,
          z: current[i].position.z + (targets[i].position.z - current[i].position.z) * smoothT * 0.1
        };
        
        // Also interpolate strength
        current[i].strength = current[i].strength + (targets[i].strength - current[i].strength) * smoothT;
      }
      
      // If arrays have different lengths, handle that case
      if (current.length < targets.length) {
        // Add new attractors
        for (let i = current.length; i < targets.length; i++) {
          current.push({...targets[i]});
        }
      } else if (current.length > targets.length) {
        // Remove excess attractors
        attractorsRef.current = current.slice(0, targets.length);
      }
      
      // Occasionally reassign boids to different attractors
      if (Math.random() < 0.01) {
        const boids = boidsRef.current;
        for (let i = 0; i < boids.length; i++) {
          if (Math.random() < 0.1) { // 10% chance for each boid to switch
            boids[i].targetAttractor = Math.floor(Math.random() * current.length);
          }
        }
      }
    }
  };

  // Initialize the simulation
  const initialize = () => {
    // Create boids with random positions and velocities in 3D space
    const boids: Boid[] = [];
    for (let i = 0; i < numBoids; i++) {
      // Cluster boids initially in the center of the 3D space
      const centerX = width / 2;
      const centerY = height / 2;
      const centerZ = depth / 2;
      const spreadFactor = 0.2; // How spread out they are initially (20% of space size)
      
      boids.push({
        position: {
          x: centerX + (Math.random() * 2 - 1) * width * spreadFactor,
          y: centerY + (Math.random() * 2 - 1) * height * spreadFactor,
          z: centerZ + (Math.random() * 2 - 1) * depth * spreadFactor
        },
        velocity: {
          x: (Math.random() * 2 - 1) * 2,
          y: (Math.random() * 2 - 1) * 2,
          z: (Math.random() * 2 - 1) * 2
        },
        acceleration: { x: 0, y: 0, z: 0 },
        id: i,
      });
    }
    boidsRef.current = boids;
    
    // Initialize spatial grid for 3D space
    gridRef.current = new SpatialGrid3D(25); // Cell size of 25 units
    
    // Create shape attractor points
    createShapeAttractors();
  };

  // Calculate magnitude (length) of a 3D vector
  const magnitude = (v: Vector3D): number => {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  };

  // Normalize a 3D vector to a certain length
  const normalize = (v: Vector3D, length: number): Vector3D => {
    const mag = magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    
    return {
      x: (v.x / mag) * length,
      y: (v.y / mag) * length,
      z: (v.z / mag) * length
    };
  };
  
  // Limit the magnitude of a 3D vector
  const limit = (v: Vector3D, max: number): Vector3D => {
    const mag = magnitude(v);
    if (mag > max) {
      return normalize(v, max);
    }
    return { ...v };
  };

  // Update attractor positions for moving shapes
  const updateAttractors = () => {
    if (shapeType === "dynamic") {
      updateDynamicAttractors();
      return;
    }
    
    if (shapeType === "splines") {
      // Check if it's time to generate new splines
      const now = Date.now();
      if (now - lastSplineChangeRef.current > splineChangeInterval) {
        generateOrganicSplines();
      }
      
      // Use the current spline points as attractors
      attractorsRef.current = splinePointsRef.current;
      return;
    }
    
    if (shapeType === "random") return; // Don't move random shape attractors
    
    const attractors = attractorsRef.current;
    if (!attractors.length) return;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const centerZ = depth / 2;
    const shapeSize = Math.min(width, height) * 0.4;
    
    // Increment time
    timeRef.current += 0.003 * warpSpeed;
    const time = timeRef.current;
    
    // Update attractor positions based on shape and time
    switch (shapeType) {
      case "warp":
        // Create a dynamic warping effect between different 3D topologies
        // This creates a constantly morphing pattern that transitions between
        // ellipses, toroids, and helices
        
        // Base parameters that will be dynamically modified
        const baseTorusRadius = shapeSize * 0.6; 
        const baseTubeRadius = shapeSize * 0.25;
        
        // Morph parameters over time
        const morphFactor1 = Math.sin(time * 0.8) * 0.5 + 0.5; // 0-1 oscillation
        const morphFactor2 = Math.cos(time * 0.5) * 0.5 + 0.5; // 0-1 oscillation, different phase
        const spiralFactor = Math.sin(time * 0.3) * 2; // Spiral tightness
        const twistFactor = time * 0.4; // Continuous twisting
        const pulseFactor = Math.sin(time * 1.2) * 0.2 + 1.0; // Size pulsing
        
        // Update each attractor point
        for (let i = 0; i < attractors.length; i++) {
          // Base position parameters
          const angle = (i / attractors.length) * Math.PI * 2;
          const phase = time + i * (Math.PI * 2 / attractors.length) * 0.2;
          
          // Morph between torus and ellipsoid
          const torusRadius = baseTorusRadius * (1 + morphFactor1 * 0.3); // Varying major radius
          const tubeRadius = baseTubeRadius * (1 + morphFactor2 * 0.4); // Varying minor radius
          
          // Helical winding effect
          const helicalFactor = Math.sin(phase) * spiralFactor;
          
          // Combine elliptical, toroidal, and helical components with smooth transitions
          // Base structure: torus (ring with tube cross-section)
          const baseX = Math.cos(angle + twistFactor) * torusRadius;
          const baseY = Math.sin(angle + twistFactor) * torusRadius;
          
          // Add tube thickness with varying radius
          const tubeX = Math.cos(angle * 3 + phase) * tubeRadius * pulseFactor;
          const tubeY = Math.sin(angle * 3 + phase) * tubeRadius * pulseFactor;
          
          // Add helical winding
          const helixZ = Math.sin(angle * 2 + phase) * helicalFactor * tubeRadius;
          
          // Combine components with morphing weights
          const morphedX = baseX + tubeX * morphFactor1;
          const morphedY = baseY + tubeY * morphFactor2;
          const morphedZ = helixZ + Math.cos(angle * 4 + phase) * tubeRadius * 0.5;
          
          // Set final position with wobble effect
          attractors[i].position = {
            x: centerX + morphedX,
            y: centerY + morphedY,
            z: centerZ + morphedZ,
          };
          
          // Dynamic strength creates pulsing attraction
          attractors[i].strength = 0.7 + 0.5 * Math.sin(time + i * 0.2);
        }
        break;
        
      case "circle":
        // Rotate the circle
        for (let i = 0; i < attractors.length; i++) {
          const angle = ((i / attractors.length) * Math.PI * 2) + time;
          attractors[i].position = {
            x: centerX + Math.cos(angle) * shapeSize,
            y: centerY + Math.sin(angle) * shapeSize,
            z: centerZ + Math.sin(time + i * 0.5) * 30 // Gentle z-oscillation
          };
        }
        break;
        
      case "figure8":
        // Animate the figure-8
        for (let i = 0; i < attractors.length; i++) {
          const t = ((i / attractors.length) * Math.PI * 2) + time;
          attractors[i].position = {
            x: centerX + Math.sin(t) * shapeSize * 0.5,
            y: centerY + Math.sin(t) * Math.cos(t) * shapeSize,
            z: centerZ + (Math.cos(t) - 1) * shapeSize * 0.2
          };
        }
        break;
        
      case "spiral":
        // Rotate the spiral
        for (let i = 0; i < attractors.length; i++) {
          const angle = ((i / attractors.length) * Math.PI * 6) + time;
          const radius = (i / attractors.length) * shapeSize;
          attractors[i].position = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            z: centerZ + (i / attractors.length) * depth * 0.3 + Math.sin(time) * 20
          };
        }
        break;
        
      case "heart":
        // Pulse the heart
        const scale = 1 + Math.sin(time * 2) * 0.1; // Pulse between 90% and 110%
        for (let i = 0; i < attractors.length; i++) {
          const t = (i / attractors.length) * Math.PI * 2;
          const x = 16 * Math.pow(Math.sin(t), 3);
          const y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          attractors[i].position = {
            x: centerX + x * (shapeSize / 16) * scale,
            y: centerY - y * (shapeSize / 16) * scale,
            z: centerZ + Math.sin(time + t * 2) * depth * 0.1
          };
        }
        break;
    }
  };

  const updateBoids = () => {
    const boids = boidsRef.current;
    const grid = gridRef.current;
    const attractors = attractorsRef.current;
    
    if (!grid) return;
    
    // Update attractor positions for moving shapes
    updateAttractors();
    
    // Clear the grid and re-add all boids
    grid.clear();
    for (const boid of boids) {
      grid.addBoid(boid);
    }

    // ----- BOID BEHAVIOR PARAMETERS -----
    // These parameters control the overall behavior of the flock simulation
    
    // How far boids can see other boids (in pixels)
    // Higher = boids react to flockmates from further away, creating larger, more coordinated groups
    // Lower = boids only react to very close neighbors, creating smaller, more fragmented groups
    const perceptionRadius = 60; // Increased for more coordinated flocking
    
    // Maximum steering force applied to each boid
    // Higher = more responsive, sharper turns but potentially more chaotic movement
    // Lower = smoother, more gradual turns but slower reaction time
    const maxForce = 0.35; // Slightly reduced for smoother turns
    
    // Maximum speed boids can travel
    // Higher = faster movement, more energetic simulation
    // Lower = slower, more deliberate movement
    const currentMaxSpeed = maxSpeed || 3; // Default to 3 if not defined

    // ----- BOID BEHAVIOR WEIGHTS -----
    // These weights control the balance between the different forces
    // Increasing a weight makes that behavior more dominant

    // ALIGNMENT: How strongly boids try to align their direction with nearby flockmates
    // Higher = stronger direction matching, more unified group movement
    // Lower = more independent movement, less coordination
    const alignmentWeight = 1.6;    // Increased for more synchronized movement
    
    // COHESION: How strongly boids are attracted to the center of their local group
    // Higher = tighter, denser flocks with stronger pull toward the center
    // Lower = more loosely connected groups, less clustering
    const cohesionWeight = 1.3;     // Increased for denser, tighter flocks like starlings
    
    // SEPARATION: How strongly boids try to avoid crowding flockmates
    // Higher = more space between boids, less dense flocks
    // Lower = closer packing, denser formations with less personal space
    const separationWeight = 1.3;   // Slightly reduced to allow for denser flocks
    
    // EDGE AVOIDANCE: How strongly boids try to stay away from container edges
    // Higher = boids strongly avoid edges, staying more centered in the container
    // Lower = boids pay less attention to edges, may bounce more frequently
    const edgeAvoidanceWeight = 3.0; // Increased to keep boids more centered
    
    // SHAPE FORMATION: How strongly boids are attracted to their target shape points
    // Higher = boids prioritize forming the target shape
    // Lower = shape is more subtle, natural flocking dominates
    const shapeFormationWeight = shapeWeight * 0.8; // Reduced relative to other forces for more natural behavior
    
    // Edge avoidance margin - how far from the edge (in pixels) boids start to react
    // Larger = boids start turning away from edges earlier (from further away)
    // Smaller = boids turn away from edges only when very close
    const edgeMargin = 80; // Increased so they stay more centered in the container

    // Update dynamics based on flock density to create density waves
    // Find the global flock center - this helps create rippling wave effects
    let globalCenterX = 0;
    let globalCenterY = 0;
    let globalCenterZ = 0;
    
    for (const boid of boids) {
      globalCenterX += boid.position.x;
      globalCenterY += boid.position.y;
      globalCenterZ += boid.position.z;
    }
    
    globalCenterX /= boids.length;
    globalCenterY /= boids.length;
    globalCenterZ /= boids.length;

    // Dynamic parameter adjustments based on time
    // This creates pulsing/breathing effects in the flock that mimic real starlings
    const time = Date.now() / 10000; // Slow wave pattern
    const pulseRate = 0.15 * Math.sin(time) + 0.85; // Varies between 0.7 and 1.0
    
    // Update each boid
    for (const boid of boids) {
      // Get neighbors using the spatial grid
      const neighbors = grid.getNeighbors(boid, perceptionRadius);
      
      // Calculate distance from global center for position-based behaviors
      const distToCenter = Math.sqrt(
        Math.pow(boid.position.x - globalCenterX, 2) +
        Math.pow(boid.position.y - globalCenterY, 2) +
        Math.pow(boid.position.z - globalCenterZ, 2)
      );
      
      // Adjust cohesion based on distance from center to create density waves
      let dynamicCohesionWeight = cohesionWeight;
      if (distToCenter > width * 0.3) {
        // Stronger cohesion for boids far from center
        dynamicCohesionWeight *= 1.5;
      }
      
      // Initialize forces
      let alignmentForce = { x: 0, y: 0, z: 0 };
      let cohesionForce = { x: 0, y: 0, z: 0 };
      let separationForce = { x: 0, y: 0, z: 0 };
      let edgeAvoidanceForce = { x: 0, y: 0, z: 0 };
      let shapeForce = { x: 0, y: 0, z: 0 };
      
      // Skip flockmate-based calculations if no neighbors
      if (neighbors.length > 0) {
        // Alignment force - steer towards the average heading of local flockmates
        let count = 0;
        
        for (const neighbor of neighbors) {
          alignmentForce.x += neighbor.velocity.x;
          alignmentForce.y += neighbor.velocity.y;
          alignmentForce.z += neighbor.velocity.z;
          count++;
        }

        if (count > 0) {
          alignmentForce.x /= count;
          alignmentForce.y /= count;
          alignmentForce.z /= count;
          
          // Normalize and scale
          const normalizedAlign = normalize(alignmentForce, currentMaxSpeed);
          
          // Calculate steering force
          alignmentForce = {
            x: normalizedAlign.x - boid.velocity.x,
            y: normalizedAlign.y - boid.velocity.y,
            z: normalizedAlign.z - boid.velocity.z
          };
          
          // Limit force
          alignmentForce = limit(alignmentForce, maxForce);
        }

        // Cohesion force - steer to move toward the average position of local flockmates
        count = 0;
        
        let centerX = 0;
        let centerY = 0;
        let centerZ = 0;
        
        for (const neighbor of neighbors) {
          centerX += neighbor.position.x;
          centerY += neighbor.position.y;
          centerZ += neighbor.position.z;
          count++;
        }

        if (count > 0) {
          centerX /= count;
          centerY /= count;
          centerZ /= count;
          
          // Vector pointing from current position to center of mass
          const toCenter = {
            x: centerX - boid.position.x,
            y: centerY - boid.position.y,
            z: centerZ - boid.position.z
          };
          
          // Normalize and scale
          const normalizedCenter = normalize(toCenter, currentMaxSpeed);
          
          // Calculate steering force
          cohesionForce = {
            x: normalizedCenter.x - boid.velocity.x,
            y: normalizedCenter.y - boid.velocity.y,
            z: normalizedCenter.z - boid.velocity.z
          };
          
          // Limit force
          cohesionForce = limit(cohesionForce, maxForce);
          
          // Apply dynamic cohesion adjustments
          cohesionForce.x *= pulseRate * dynamicCohesionWeight / cohesionWeight;
          cohesionForce.y *= pulseRate * dynamicCohesionWeight / cohesionWeight;
          cohesionForce.z *= pulseRate * dynamicCohesionWeight / cohesionWeight;
        }

        // Separation force - steer to avoid crowding local flockmates
        count = 0;
        
        for (const neighbor of neighbors) {
          const dx = boid.position.x - neighbor.position.x;
          const dy = boid.position.y - neighbor.position.y;
          const dz = boid.position.z - neighbor.position.z;
          const distSquared = dx * dx + dy * dy + dz * dz;
          
          if (distSquared > 0) {
            // The closer the neighbor, the stronger the force (inverse relationship)
            const separationFactor = 1 / Math.sqrt(distSquared);
            separationForce.x += dx * separationFactor;
            separationForce.y += dy * separationFactor;
            separationForce.z += dz * separationFactor;
            count++;
          }
        }

        if (count > 0) {
          separationForce.x /= count;
          separationForce.y /= count;
          separationForce.z /= count;
          
          // Normalize and scale
          const normalizedSep = normalize(separationForce, currentMaxSpeed);
          
          // Calculate steering force
          separationForce = {
            x: normalizedSep.x - boid.velocity.x,
            y: normalizedSep.y - boid.velocity.y,
            z: normalizedSep.z - boid.velocity.z
          };
          
          // Limit force
          separationForce = limit(separationForce, maxForce);
        }
      }

      // Shape formation force - steer towards the boid's target attractor
      if (attractors.length > 0 && boid.targetAttractor !== undefined) {
        // For dynamic attractors, we want to occasionally switch attractors
        // to create more varied patterns
        if (shapeType === "dynamic" && Math.random() < 0.001) {
          boid.targetAttractor = Math.floor(Math.random() * attractors.length);
        }
        
        const attractor = attractors[boid.targetAttractor % attractors.length];
        
        // Vector pointing from boid to attractor
        const toAttractor = {
          x: attractor.position.x - boid.position.x,
          y: attractor.position.y - boid.position.y,
          z: attractor.position.z - boid.position.z
        };
        
        // Distance to attractor
        const distToAttractor = magnitude(toAttractor);
        
        // Calculate attraction strength - stronger when far, weaker when close
        // For dynamic attractors, we want faster response so increase the force
        const normalizedStrength = Math.min(1.0, 
          shapeType === "dynamic" ? distToAttractor / 70 : distToAttractor / 100);
        
        // Normalize and scale
        if (distToAttractor > 0) {
          const normalizedDirection = normalize(toAttractor, currentMaxSpeed * normalizedStrength);
          
          // Calculate steering force
          shapeForce = {
            x: normalizedDirection.x - boid.velocity.x * 0.5, // Dampen velocity influence
            y: normalizedDirection.y - boid.velocity.y * 0.5,
            z: normalizedDirection.z - boid.velocity.z * 0.5
          };
          
          // Limit force
          shapeForce = limit(shapeForce, maxForce * attractor.strength);
        }
      }

      // Edge avoidance force - steer away from edges
      // Check distance to each boundary and calculate avoidance force
      const distToLeft = boid.position.x;
      const distToRight = width - boid.position.x;
      const distToTop = boid.position.y;
      const distToBottom = height - boid.position.y;
      const distToFront = boid.position.z;
      const distToBack = depth - boid.position.z;
      
      // Initialize edge avoidance forces for each direction
      let edgeForceX = 0;
      let edgeForceY = 0;
      let edgeForceZ = 0;
      
      // Apply forces based on distance to edges
      if (distToLeft < edgeMargin) {
        // Getting close to left edge, steer right
        const intensity = 1 - (distToLeft / edgeMargin); // Stronger force as we get closer
        edgeForceX += maxForce * intensity;
      }
      
      if (distToRight < edgeMargin) {
        // Getting close to right edge, steer left
        const intensity = 1 - (distToRight / edgeMargin);
        edgeForceX -= maxForce * intensity;
      }
      
      if (distToTop < edgeMargin) {
        // Getting close to top edge, steer down
        const intensity = 1 - (distToTop / edgeMargin);
        edgeForceY += maxForce * intensity;
      }
      
      if (distToBottom < edgeMargin) {
        // Getting close to bottom edge, steer up
        const intensity = 1 - (distToBottom / edgeMargin);
        edgeForceY -= maxForce * intensity;
      }
      
      // Z-axis edge avoidance
      if (distToFront < edgeMargin) {
        // Getting close to front edge, steer back
        const intensity = 1 - (distToFront / edgeMargin);
        edgeForceZ += maxForce * intensity;
      }
      
      if (distToBack < edgeMargin) {
        // Getting close to back edge, steer forward
        const intensity = 1 - (distToBack / edgeMargin);
        edgeForceZ -= maxForce * intensity;
      }
      
      // Set the edge avoidance force
      edgeAvoidanceForce = {
        x: edgeForceX,
        y: edgeForceY,
        z: edgeForceZ
      };
      
      // Limit edge avoidance force if it's too strong
      edgeAvoidanceForce = limit(edgeAvoidanceForce, maxForce);

      // Apply all forces with weights and dynamic adjustments
      boid.acceleration = {
        x: alignmentForce.x * alignmentWeight +
           cohesionForce.x +
           separationForce.x * separationWeight * (1 + 0.3 * Math.sin(time * 2 + boid.id * 0.05)) +
           edgeAvoidanceForce.x * edgeAvoidanceWeight +
           shapeForce.x * shapeFormationWeight,
        y: alignmentForce.y * alignmentWeight +
           cohesionForce.y +
           separationForce.y * separationWeight * (1 + 0.3 * Math.sin(time * 2 + boid.id * 0.05)) +
           edgeAvoidanceForce.y * edgeAvoidanceWeight +
           shapeForce.y * shapeFormationWeight,
        z: alignmentForce.z * alignmentWeight +
           cohesionForce.z +
           separationForce.z * separationWeight * (1 + 0.3 * Math.sin(time * 2 + boid.id * 0.05)) +
           edgeAvoidanceForce.z * edgeAvoidanceWeight +
           shapeForce.z * shapeFormationWeight
      };
      
      // Add a small random force to create more organic movement
      boid.acceleration.x += (Math.random() * 2 - 1) * 0.01;
      boid.acceleration.y += (Math.random() * 2 - 1) * 0.01;
      boid.acceleration.z += (Math.random() * 2 - 1) * 0.01;
    }

    // Update positions and velocities
    for (const boid of boids) {
      // Update velocity
      boid.velocity.x += boid.acceleration.x;
      boid.velocity.y += boid.acceleration.y;
      boid.velocity.z += boid.acceleration.z;
      
      // Limit speed
      boid.velocity = limit(boid.velocity, currentMaxSpeed);
      
      // Update position
      boid.position.x += boid.velocity.x;
      boid.position.y += boid.velocity.y;
      boid.position.z += boid.velocity.z;
      
      // Reset acceleration
      boid.acceleration = { x: 0, y: 0, z: 0 };
      
      // Still keep the hard boundary to prevent boids from going outside the 3D space
      // if the edge avoidance force wasn't strong enough
      if (boid.position.x < 0) {
        boid.position.x = 0;
        boid.velocity.x *= -0.5; // Less bounce energy
      } else if (boid.position.x > width) {
        boid.position.x = width;
        boid.velocity.x *= -0.5; // Less bounce energy
      }
      
      if (boid.position.y < 0) {
        boid.position.y = 0;
        boid.velocity.y *= -0.5; // Less bounce energy
      } else if (boid.position.y > height) {
        boid.position.y = height;
        boid.velocity.y *= -0.5; // Less bounce energy
      }
      
      if (boid.position.z < 0) {
        boid.position.z = 0;
        boid.velocity.z *= -0.5; // Less bounce energy
      } else if (boid.position.z > depth) {
        boid.position.z = depth;
        boid.velocity.z *= -0.5; // Less bounce energy
      }
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Use maxSpeed from props or ref for the velocity calculations
    const currentMaxSpeed = maxSpeed || 3; // Default to 3 if not defined
    
    // Apply motion blur effect if trails are enabled
    if (showTrails) {
      // Create semi-transparent layer over previous frame
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - trailOpacity})`;
      
      if (backgroundColor === "transparent") {
        // For transparent backgrounds, use clearRect with reduced alpha
        ctx.globalAlpha = 1 - trailOpacity;
        ctx.clearRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      } else {
        // For colored backgrounds, use a semi-transparent overlay
        // This preserves the background color while creating trails
        const bgColor = backgroundColor === "currentColor" ? "black" : backgroundColor;
        // Parse the background color to get RGB components
        let r = 0, g = 0, b = 0;
        if (bgColor.startsWith("rgb")) {
          const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (match) {
            [, r, g, b] = match.map(Number);
          }
        }
        // Apply semi-transparent version of background color
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${1 - trailOpacity})`;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // No trails - clear canvas completely
      if (backgroundColor === "transparent") {
        // Use clearRect for true transparency
        ctx.clearRect(0, 0, width, height);
      } else {
        // Use fillRect for colored backgrounds
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }
    }
    
    // Optionally render attractor points (helpful for debugging)
    const showAttractors = false;
    if (showAttractors) {
      for (const attractor of attractorsRef.current) {
        // Project the 3D position to 2D (simple projection for debugging)
        ctx.beginPath();
        ctx.arc(attractor.position.x, attractor.position.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        ctx.fill();
      }
    }
    
    // Sort boids by z-position for proper layering (painter's algorithm)
    // Boids with larger z values (further back) are drawn first
    const sortedBoids = [...boidsRef.current].sort((a, b) => b.position.z - a.position.z);
    
    // Extract the current foreground color from the canvas or its parent
    let actualColor = boidColor;
    if (boidColor === "currentColor" && canvas.parentElement) {
      // Get the current text color from computed styles
      const computedStyle = window.getComputedStyle(canvas.parentElement);
      actualColor = computedStyle.color;
    }
    
    // Create a subtle "wave" effect through the flock - common in starling murmurations
    const time = Date.now() / 10000;
    
    // Draw boids with depth cues
    for (const boid of sortedBoids) {
      // Normalized z position (0 to 1) - 0 is closest, 1 is furthest
      const zNormalized = boid.position.z / depth;
      
      // Size based on z - closer boids appear larger (perspective)
      const sizeScale = 1 - (zNormalized * 0.7); // Size ranges from 30% to 100%
      
      // Add slight size variation based on boid ID for more natural appearance
      const sizeVariation = 0.2 * Math.sin(boid.id * 0.1 + time); // ±20% size variation
      const displayRadius = boidRadius * sizeScale * (1 + sizeVariation);
      
      // Opacity based on z - closer boids are more opaque
      const baseOpacity = 1 - (zNormalized * 0.6); // Base opacity from 40% to 100%
      
      // Add subtle opacity variation based on wave pattern
      const wavePhase = (boid.position.x / width + boid.position.y / height) * 4;
      const opacityVariation = 0.15 * Math.sin(time * 2 + wavePhase); // ±15% opacity variation
      const opacity = Math.max(0.1, Math.min(1, baseOpacity + opacityVariation));
      
      // Set fill style with appropriate opacity and subtle color variation
      let fillStyle = actualColor;
      
      // If we can parse RGB values, add opacity and create subtle color variations
      if (actualColor.startsWith('rgb')) {
        fillStyle = actualColor.replace(/rgba?\(([^)]+)\)/, (match, params) => {
          const rgbValues = params.split(',').map((v: string) => v.trim());
          if (rgbValues.length >= 3) {
            // Add slight color variation based on position
            const r = Math.min(255, Math.max(0, parseInt(rgbValues[0]) + Math.floor(sizeVariation * 5)));
            const g = Math.min(255, Math.max(0, parseInt(rgbValues[1]) + Math.floor(sizeVariation * 5)));
            const b = Math.min(255, Math.max(0, parseInt(rgbValues[2]) + Math.floor(sizeVariation * 5)));
            
            // It's RGB, convert to RGBA with our calculated opacity
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          }
          // It's already RGBA, replace the alpha
          return `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${opacity})`;
        });
      } else {
        // For non-RGB colors, use a fallback
        fillStyle = `rgba(0, 0, 0, ${opacity})`;
      }
      
      // Calculate velocity magnitude to elongate boids in direction of movement
      const velocityMag = magnitude(boid.velocity);
      const velocityNormalized = Math.min(1, velocityMag / currentMaxSpeed);
      
      // Direction of motion for elongation
      const direction = {
        x: boid.velocity.x / (velocityMag || 1),
        y: boid.velocity.y / (velocityMag || 1)
      };
      
      // Draw slightly elongated shape in direction of movement (like real birds)
      if (velocityMag > 0.1) {
        // Draw elongated shape for moving boids
        const stretchFactor = 1 + velocityNormalized * 0.7; // Up to 70% longer in direction of movement
        
        // Start a new path
        ctx.beginPath();
        
        // Move to the "back" of the boid
        ctx.moveTo(
          boid.position.x - direction.x * displayRadius * stretchFactor,
          boid.position.y - direction.y * displayRadius * stretchFactor
        );
        
        // Draw a teardrop shape elongated in the direction of movement
        // This creates a more bird-like appearance than perfect circles
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          // Calculate radius based on angle relative to movement direction
          // Front of boid is pointier, back is more rounded
          const angleFromDirection = Math.abs(Math.atan2(
            Math.sin(angle), 
            Math.cos(angle) * stretchFactor
          ));
          
          const radiusMultiplier = 0.8 + 0.2 * (1 - Math.cos(angleFromDirection));
          
          ctx.lineTo(
            boid.position.x + Math.cos(angle) * displayRadius * radiusMultiplier,
            boid.position.y + Math.sin(angle) * displayRadius * radiusMultiplier
          );
        }
        
        ctx.closePath();
      } else {
        // Draw circles for slow/non-moving boids
        ctx.beginPath();
        ctx.arc(boid.position.x, boid.position.y, displayRadius, 0, Math.PI * 2);
      }
      
      // Set color with opacity
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
  };

  const animate = () => {
    updateBoids();
    render();
    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    initialize();
    animate();
    
    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height, depth, numBoids, shapeType, shapeComplexity, numDynamicAttractors, attractorChangeInterval]);

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-md overflow-hidden w-full h-full object-cover"
      />
    </div>
  );
} 