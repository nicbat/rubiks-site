<script>
  import { profilePicture } from "../pfps.js";
  let { id, small = false } = $props();
  let picture = $derived(profilePicture(id));
</script>

<img
  class="profile-picture"
  class:small
  src={picture.src}
  alt=""
  width={small ? 28 : 72}
  height={small ? 28 : 72}
/>

<style>
  .profile-picture {
    display: inline-block;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .small {
    width: 28px;
    height: 28px;
  }
</style>
