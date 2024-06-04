import datetime
import itertools
from pathlib import Path


import matplotlib.path as mpltPath
import numpy as np

from qcore import coordinates

from Velocity_Model.z import basin_outlines_dict
from mpi4py import MPI


x_start = 1060100
x_end = 2120000
y_start = 4730100
y_end = 6250000
spacing = 100
x_range = range(x_start, x_end, spacing)
y_range = range(y_start, y_end, spacing)

comm = MPI.COMM_WORLD
rank = comm.Get_rank()
num_cores =  comm.Get_size()


BASIN_VER = "2.07"
basin_outlines = basin_outlines_dict[BASIN_VER]


outdir = Path("outdir")
out_csv = outdir / f"basin_stats_{rank:04d}.csv" # lon, lat, nztm_x, nztm_y, True, basin_name
#168.2632171899503, -44.71216293699213, 1224800, 5038100, True, WakatipuBasinOutlineWGS84.txt

out_ll = outdir / f"basin_stats_{rank:04d}.ll" # lon lat nztm_x_nztm_y
#168.2632171899503 -44.71216293699213 1224800_5038100

checkpoint = outdir / f"checkpoint_{rank:04d}.txt" #idx max_idx

class Buffer:
# Checkpointing/Resuming-enabled Write Buffer: Write to file when checkpoint_interval is reached
    def __init__(self, rank, out_csv, out_ll, checkpoint, max_idx, start_time = None, checkpoint_interval = 1000):
        self.checkpoint_interval = checkpoint_interval
        self.reset()
        self.ocf = out_csv
        self.olf = out_ll
        self.rank = rank
        self.checkpoint_idx=-1 # the value read from the checkpoint. by default -1
        self.max_idx = max_idx
        self.cpf = checkpoint

        if start_time is None:
            self.start = datetime.datetime.now()
        else:
            self.start = start_time

        resuming = False
        if self.cpf.exists():
            with open(self.cpf,"r") as f:
                line=f.read().splitlines()
            try:
                self.checkpoint_idx = int(line[-1].split()[0]) # from "checkpoint_idx max_idx", take checkpoint_idx
            except ValueError:
                print(f"Error: rank:{self.rank} Checkpoint read failed. Starting from 0")
            assert self.checkpoint_idx <= self.max_idx, f"Error: rank:{self.rank} Invalid Checkpoint idx {self.checkpoint_idx} > {self.max_idx}"
            if self.checkpoint_idx == self.max_idx:
                print(f"Info: rank:{self.rank} Already completed")
            resuming = True

        if not resuming: #fresh start
            with open(self.ocf,"w") as f:
                pass
            with open(self.olf,"w") as f:
                pass
 
    def reset(self):
        self.counter = 0
        self.contents_csv=""
        self.contents_ll=""

    def write(self,to_print_csv, to_print_ll): #called when buffer contents needs to be added
        self.contents_csv += to_print_csv
        self.contents_ll += to_print_ll
 
    def tick(self,idx): # called everytime idx increases
        self.counter += 1
        if self.counter == self.checkpoint_interval:
            self.checkpoint(idx)


    #NOTE: If this job is killed due to wallclock limit while checkpointing, there may be a case where writing to csv and/or ll files are complete, but checkpoint file is not
    # When restarted, the process will restart from the last successfully checkpointed idx. From the perspective of csv or ll, this can be a jump backward.
    # As a result, some points can be written more than once to the csv or ll files. Duplicates shouldn't cause a problem in the subsequent process
    def checkpoint(self, idx):
        now = datetime.datetime.now()
        print(f"rank:{self.rank} ---{idx} / {self.max_idx} -- {(now - self.start).seconds / 60:.2f} minutes elapsed -- est_completion_time:     {(now - self.start) / (idx-self.checkpoint_idx+1) * (self.max_idx-self.checkpoint_idx+1) + self.start}")

        with open(self.ocf,"a") as f:
           f.write(self.contents_csv)
        with open(self.olf, "a") as f:
           f.write(self.contents_ll)
        self.reset()

        with open(self.cpf,"w") as f:
            f.write(f"{idx} {self.max_idx}\n") # just write, don't update self.checkpoint_idx,which is updated only when restarted
 


if __name__ == "__main__":

    x_range_per_core = int(np.ceil(len(x_range) /num_cores)) 
    rank_x_range = x_range[rank*x_range_per_core: (rank+1)*x_range_per_core]

    # the whole x_range x y_range grid is split into strips of (x_range_per_core x y_range)
    nztm_points = list(itertools.product(rank_x_range,y_range)) 

    if len(nztm_points) > 0:
        
        start = datetime.datetime.now()
        # wgs_depth_to_nztm expects (n x 3) input, so we need to add a column of zeros for depth
        nztm_depth = np.c_[nztm_points, np.zeros_like(nztm_points[:, 0])]
        ll_points = coordinates.nztm_to_wgs_depth(nztm_depth)[:, :2]
        ll_points = ll_points[:, ::-1] # Compatability with the old code requires we reverse the coordinates 
        n_points = len(ll_points)

        buffer = Buffer(rank, out_csv, out_ll, checkpoint, n_points-1, start_time=start)

        now = datetime.datetime.now()
        print(f"rank:{rank} Took {(start - now).seconds}s to load data, {n_points} points")


        last_basin_idx = 0

        #load the first basin details
        outline_fp = basin_outlines[last_basin_idx]
        outline_path = mpltPath.Path(np.loadtxt(outline_fp))

        for i in range(buffer.checkpoint_idx+1,n_points):

            basin_tested = 0

            while basin_tested < len(basin_outlines):
                # we try the same basin (ie. basin), it's highly likely neighbouring locations belong to the same basin
                if outline_path.contains_point((ll_points[i][0],ll_points[i][1])):

                    to_print_csv = f"{ll_points[i][0]}, {ll_points[i][1]}, {nztm_points[i][0]}, {nztm_points[i][1]}, {True}, {outline_fp.name}\n"
                    to_print_ll = f"{ll_points[i][0]} {ll_points[i][1]} {nztm_points[i][0]}_{nztm_points[i][1]}\n"
                    buffer.write(to_print_csv, to_print_ll)
                    break

                # the basin we tried doesn't contain this point. Try the next one 
                last_basin_idx += 1
                last_basin_idx = last_basin_idx % len(basin_outlines) # go back to the first basin
                basin_tested+= 1

                outline_fp = basin_outlines[last_basin_idx] #load the details. will be using this for the next iteration
                outline_path = mpltPath.Path(np.loadtxt(outline_fp))


            buffer.tick(i) # counter increases regardless of this point being in/out of  basin


        #all finished. there may be some contents in buffer that needs to be written to file

        print(f"rank:{rank}, All completed {buffer.max_idx}")
        buffer.checkpoint(buffer.max_idx)
    else:
        print(f"rank:{rank}, Nothing to do")

