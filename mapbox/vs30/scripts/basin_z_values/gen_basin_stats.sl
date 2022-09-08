#!/bin/bash
# script version: slurm
#
#SBATCH --job-name=gen_basin_stats
#SBATCH --account=nesi00213
#SBATCH --partition=nesi_research
#SBATCH --time=24:00:00
#SBATCH --ntasks=1340              # number of tasks (e.g. MPI)
#SBATCH --cpus-per-task=1       # number of cores per task (e.g. OpenMP)
#SBATCH -o %x.%j.out
#SBATCH -e %x.%j.err
#SBATCH --hint=nomultithread    # don't use hyperthreading

echo $VMDIR
export PYTHONPATH=$VMDIR:$PYTHONPATH 
mkdir -p outdir
srun python gen_basin_stats.py

