<script lang="ts">
    import { goto, invalidateAll } from "$app/navigation";
    import { page } from "$app/state";
	import "../app.css";

	let { data, children } = $props();
</script>

<div class="flex h-screen w-screen bg-gray-50/25">
	<div class="hidden sm:flex w-50 h-screen flex-col justify-between border-e border-gray-100 bg-white">
		<div class="px-4 py-6">
			<span
				class="flex h-10 w-full place-content-center"
			>
				<img src="/logo.svg" alt="Rusty Cluster" class="h-10">
			</span>

			<ul class="mt-6 space-y-1">

				<li>
					<a
						href="/"
						class="{page.url.pathname === '/' ? 'bg-gray-100' : ''} block rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					>
						Overview
					</a>
				</li>

				<li>
					<details
						class="group [&_summary::-webkit-details-marker]:hidden"
					>
						<summary
							class="{page.url.pathname.startsWith('/cluster/') ? 'bg-gray-100' : ''} flex cursor-pointer items-center justify-between rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
						>
							<span class="text-sm font-medium"> Clusters </span>

							<span
								class="shrink-0 transition duration-300 group-open:-rotate-180"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="size-5"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fill-rule="evenodd"
										d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
										clip-rule="evenodd"
									/>
								</svg>
							</span>
						</summary>

						<ul class="mt-2 space-y-1 px-4">

							{#each data.layout.clusters as cluster}
								<li>
									<a
										href="/cluster/{cluster.id}"
										class="{page.url.pathname.startsWith(`/cluster/${cluster.id}`) ? 'bg-gray-100' : ''} block rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 capitalize"
									>
										{cluster.name}
									</a>
								</li>
							{/each}
						</ul>
					</details>
				</li>

				<li>
					<a
						href="/"
						class="block rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					>
						Settings
					</a>
				</li>

			</ul>
		</div>

	</div>
	
	<div class="p-6 sm:p-4 h-screen overflow-y-auto grow">
		{#if page.url.pathname.startsWith(`/cluster/`)}
			{#key page.url.pathname}
				{@render children()}
			{/key}
		{:else}
			{@render children()}
		{/if}
	</div>
</div>
