#!/bin/bash
# script version: slurm
#
# Run on Maui

#SBATCH --job-name=get_z_values
#SBATCH --account=nesi00213
#SBATCH --mem=180G
#SBATCH --time=00:30:00 # time for each array job
#SBATCH --array=0-79%4 # 80 array jobs with 4 jobs running at a time
##SBATCH --ntasks=4              # seems unnecessarsy due to the line above
#SBATCH --nodes=2  # Each job takes 96Gb maximum
#SBATCH --cpus-per-task=1       # number of cores per task (e.g. OpenMP)
#SBATCH -o %x.%A.%a.out
#SBATCH -e %x.%A.%a.err

#SBATCH --hint=nomultithread    # don't use hyperthreading


#USAGE:
#1. locate the root dir of Velocity-Model (VMDIR), then
#2. submit with sbatch --export=ALL,VMDIR=.... get_z_values.sl

#We are using SLURM job arrays. Internally we have the following variables set.
#$SLURM_ARRAY_TASK_ID  one in the range of 0-79
#echo $SLURM_ARRAY_TASK_MIN 0
#echo $SLURM_ARRAY_TASK_MAX 79

#at a time. we have only 4 array jobs running. each array job its own task id 0-79

export PYTHONPATH=$VMDIR:$PYTHONPATH

i=`printf %04d $SLURM_ARRAY_TASK_ID` # convert to 4-digit number eg. 1 --> 0001
infile= sites_in_basin_whole_nz.csv_${i} # eg.  sites_in_basin_whole_nz.csv_0001
outfile=${infile/.csv/.z} # eg. sites_in_basin_whole_nz.z_0001

indir=splits
outdir=z_values

echo $infile
echo $outfile
mkdir -p $outdir

cmd="python $VMDIR/Velocity_Model/scripts/get_z.py -ll $indir/$infile --nzvm-path `which NZVM` -v 2.07 -z Z1.0 Z2.5 -o $outdir/$outfile --no_header"
echo $cmd
`$cmd`


